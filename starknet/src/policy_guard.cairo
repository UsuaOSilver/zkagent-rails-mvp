use starknet::ContractAddress;

#[starknet::interface]
trait IPolicyGuard<TContractState> {
    fn set_policy(
        ref self: TContractState,
        user: ContractAddress,
        commitment: felt252,
        allowed: bool
    );
    fn check_policy(self: @TContractState, user: ContractAddress, commitment: felt252) -> bool;
    fn get_attester(self: @TContractState) -> ContractAddress;
    fn set_attester(ref self: TContractState, new_attester: ContractAddress);
}

#[starknet::contract]
mod policy_guard {
    use starknet::ContractAddress;
    use starknet::storage::Map;
    use starknet::get_caller_address;
    use core::num::traits::Zero;

    // Import OpenZeppelin Ownable component for access control
    use openzeppelin::access::ownable::OwnableComponent;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    // Ownable Mixin
    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        // Attester address that can set policies (separate from owner)
        attester: ContractAddress,
        // Map (user, commitment) -> bool (using bool instead of u8 for clarity)
        policy: Map<(ContractAddress, felt252), bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        PolicySet: PolicySet,
        AttesterChanged: AttesterChanged,
    }

    #[derive(Drop, starknet::Event)]
    struct PolicySet {
        #[key]
        user: ContractAddress,
        #[key]
        commitment: felt252,
        allowed: bool,
        set_by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct AttesterChanged {
        #[key]
        previous_attester: ContractAddress,
        #[key]
        new_attester: ContractAddress,
    }

    mod Errors {
        pub const ONLY_ATTESTER: felt252 = 'Only attester can set policy';
        pub const ONLY_OWNER: felt252 = 'Only owner can change attester';
        pub const INVALID_ATTESTER: felt252 = 'Attester cannot be zero';
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, attester: ContractAddress) {
        // Initialize Ownable component
        self.ownable.initializer(owner);

        // Set initial attester
        assert(!attester.is_zero(), Errors::INVALID_ATTESTER);
        self.attester.write(attester);
    }

    #[abi(embed_v0)]
    impl PolicyGuardImpl of super::IPolicyGuard<ContractState> {
        /// Set whether `user` is allowed for a given `commitment` (hashed plan).
        /// Only the attester can call this function.
        fn set_policy(
            ref self: ContractState,
            user: ContractAddress,
            commitment: felt252,
            allowed: bool
        ) {
            self._assert_only_attester();

            self.policy.write((user, commitment), allowed);

            self.emit(PolicySet {
                user,
                commitment,
                allowed,
                set_by: get_caller_address(),
            });
        }

        /// View: returns true if allowed
        fn check_policy(self: @ContractState, user: ContractAddress, commitment: felt252) -> bool {
            self.policy.read((user, commitment))
        }

        /// Get the current attester address
        fn get_attester(self: @ContractState) -> ContractAddress {
            self.attester.read()
        }

        /// Owner can update the attester address
        fn set_attester(ref self: ContractState, new_attester: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!new_attester.is_zero(), Errors::INVALID_ATTESTER);

            let previous_attester = self.attester.read();
            self.attester.write(new_attester);

            self.emit(AttesterChanged {
                previous_attester,
                new_attester,
            });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_only_attester(self: @ContractState) {
            let caller = get_caller_address();
            let attester = self.attester.read();
            assert(caller == attester, Errors::ONLY_ATTESTER);
        }
    }
}
