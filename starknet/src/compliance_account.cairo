use starknet::account::Call;

#[starknet::interface]
trait IComplianceAccount<TContractState> {
    // SRC6 Standard
    fn __execute__(self: @TContractState, calls: Array<Call>) -> Array<Span<felt252>>;
    fn __validate__(self: @TContractState, calls: Array<Call>) -> felt252;
    fn is_valid_signature(self: @TContractState, hash: felt252, signature: Array<felt252>) -> felt252;

    // Account management
    fn get_public_key(self: @TContractState) -> felt252;
    fn set_public_key(ref self: TContractState, new_public_key: felt252, signature: Span<felt252>);

    // Policy guard integration
    fn get_policy_guard(self: @TContractState) -> starknet::ContractAddress;
    fn set_policy_guard(ref self: TContractState, policy_guard: starknet::ContractAddress);
}

#[starknet::contract]
mod ComplianceAccount {
    use super::Call;
    use starknet::{
        ContractAddress, get_caller_address, get_tx_info, get_contract_address,
        call_contract_syscall
    };
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;

    // Import OpenZeppelin Account component for SRC6 implementation
    use openzeppelin::account::AccountComponent;
    use openzeppelin::account::interface;
    use openzeppelin::introspection::src5::SRC5Component;

    component!(path: AccountComponent, storage: account, event: AccountEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    // Account Mixin
    #[abi(embed_v0)]
    impl AccountMixinImpl = AccountComponent::AccountMixinImpl<ContractState>;
    impl AccountInternalImpl = AccountComponent::InternalImpl<ContractState>;

    // SRC5 Mixin
    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        account: AccountComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        // Policy guard contract address for compliance checks
        policy_guard: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        AccountEvent: AccountComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        PolicyGuardSet: PolicyGuardSet,
        TransactionValidated: TransactionValidated,
    }

    #[derive(Drop, starknet::Event)]
    struct PolicyGuardSet {
        #[key]
        previous_policy_guard: ContractAddress,
        #[key]
        new_policy_guard: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct TransactionValidated {
        #[key]
        account: ContractAddress,
        #[key]
        commitment: felt252,
        policy_approved: bool,
        tx_hash: felt252,
    }

    mod Errors {
        pub const INVALID_CALLER: felt252 = 'Invalid caller';
        pub const INVALID_SIGNATURE: felt252 = 'Invalid signature';
        pub const POLICY_CHECK_FAILED: felt252 = 'Policy check failed';
        pub const INVALID_TX_VERSION: felt252 = 'Invalid transaction version';
        pub const UNAUTHORIZED: felt252 = 'Unauthorized';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        public_key: felt252,
        policy_guard: ContractAddress
    ) {
        // Initialize Account component with public key
        self.account.initializer(public_key);

        // Register SRC6 interface
        self.src5.register_interface(interface::ISRC6_ID);

        // Set policy guard
        self.policy_guard.write(policy_guard);
    }

    #[abi(embed_v0)]
    impl ComplianceAccountImpl of super::IComplianceAccount<ContractState> {
        fn __execute__(self: @ContractState, calls: Array<Call>) -> Array<Span<felt252>> {
            // Only protocol can call __execute__
            assert(get_caller_address().is_zero(), Errors::INVALID_CALLER);

            // Delegate to OpenZeppelin Account component
            self.account.__execute__(calls)
        }

        fn __validate__(self: @ContractState, calls: Array<Call>) -> felt252 {
            // Only protocol can call __validate__
            assert(get_caller_address().is_zero(), Errors::INVALID_CALLER);

            // First validate signature using OpenZeppelin component
            let is_valid_signature = self.account.__validate__(calls);

            if is_valid_signature != starknet::VALIDATED {
                return 0;
            }

            // Then check policy guard for compliance
            if !self.policy_guard.read().is_zero() {
                let policy_valid = self._check_policy_compliance(@calls);

                if !policy_valid {
                    return 0;
                }
            }

            starknet::VALIDATED
        }

        fn is_valid_signature(
            self: @ContractState,
            hash: felt252,
            signature: Array<felt252>
        ) -> felt252 {
            // Delegate to OpenZeppelin Account component
            self.account.is_valid_signature(hash, signature)
        }

        fn get_public_key(self: @ContractState) -> felt252 {
            self.account.get_public_key()
        }

        fn set_public_key(
            ref self: ContractState,
            new_public_key: felt252,
            signature: Span<felt252>
        ) {
            self.account.set_public_key(new_public_key, signature);
        }

        fn get_policy_guard(self: @ContractState) -> ContractAddress {
            self.policy_guard.read()
        }

        fn set_policy_guard(ref self: ContractState, policy_guard: ContractAddress) {
            // Only the account itself can update policy guard
            self.account.assert_only_self();

            let previous = self.policy_guard.read();
            self.policy_guard.write(policy_guard);

            self.emit(PolicyGuardSet {
                previous_policy_guard: previous,
                new_policy_guard: policy_guard,
            });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _check_policy_compliance(self: @ContractState, calls: @Array<Call>) -> bool {
            if calls.len() == 0 {
                return false;
            }

            // Get the policy guard dispatcher
            let policy_guard_address = self.policy_guard.read();
            if policy_guard_address.is_zero() {
                return true; // No policy guard set, allow transaction
            }

            // For now, we check the first call
            // In production, you'd iterate through all calls
            let first_call = calls.at(0);

            // Extract commitment from call data (this depends on your call structure)
            // For demonstration, we'll use the selector as commitment
            let commitment = *first_call.selector;

            // Call policy guard to check if this operation is allowed
            let account_address = get_contract_address();

            // Use call_contract_syscall to check policy
            let calldata = array![account_address.into(), commitment];
            let result = call_contract_syscall(
                policy_guard_address,
                selector!("check_policy"),
                calldata.span()
            );

            match result {
                Result::Ok(mut ret_data) => {
                    if ret_data.len() > 0 {
                        let policy_result = *ret_data.at(0);
                        let policy_approved = policy_result != 0;

                        // Emit event for tracking
                        self.emit(TransactionValidated {
                            account: account_address,
                            commitment,
                            policy_approved,
                            tx_hash: get_tx_info().unbox().transaction_hash,
                        });

                        return policy_approved;
                    }
                    false
                },
                Result::Err(_) => false
            }
        }
    }
}
