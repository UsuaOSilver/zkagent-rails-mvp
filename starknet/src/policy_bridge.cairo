use starknet::ContractAddress;

#[starknet::interface]
trait IPolicyBridge<TContractState> {
    // L2 -> L1: Send policy updates to Ethereum
    fn sync_policy_to_l1(
        ref self: TContractState,
        user: ContractAddress,
        commitment: felt252,
        allowed: bool
    );

    // Configuration
    fn set_l1_bridge(ref self: TContractState, l1_bridge_address: felt252);
    fn set_policy_guard(ref self: TContractState, policy_guard: ContractAddress);

    // Getters
    fn get_l1_bridge(self: @TContractState) -> felt252;
    fn get_policy_guard(self: @TContractState) -> ContractAddress;
    fn get_message_count(self: @TContractState) -> u128;
}

#[starknet::contract]
mod PolicyBridge {
    use starknet::{
        ContractAddress, get_caller_address, syscalls::send_message_to_l1_syscall,
        SyscallResultTrait
    };
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess
    };
    use core::num::traits::Zero;

    // Import OpenZeppelin Ownable for access control
    use openzeppelin::access::ownable::OwnableComponent;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    // Import policy guard interface for dispatcher
    use super::policy_guard::{IPolicyGuardDispatcher, IPolicyGuardDispatcherTrait};

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        // L1 bridge contract address (as felt252 for Ethereum address)
        l1_bridge_address: felt252,
        // L2 policy guard contract
        policy_guard: ContractAddress,
        // Track message count for debugging
        message_count: u128,
        // Track messages sent
        messages_sent: Map<u128, PolicyMessage>,
    }

    #[derive(Drop, Copy, Serde, starknet::Store)]
    struct PolicyMessage {
        user: ContractAddress,
        commitment: felt252,
        allowed: bool,
        timestamp: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        PolicySyncedToL1: PolicySyncedToL1,
        PolicySyncedFromL1: PolicySyncedFromL1,
        L1BridgeSet: L1BridgeSet,
        PolicyGuardSet: PolicyGuardSet,
    }

    #[derive(Drop, starknet::Event)]
    struct PolicySyncedToL1 {
        #[key]
        message_id: u128,
        #[key]
        user: ContractAddress,
        #[key]
        commitment: felt252,
        allowed: bool,
        l1_bridge: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct PolicySyncedFromL1 {
        #[key]
        user: ContractAddress,
        #[key]
        commitment: felt252,
        allowed: bool,
        from_address: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct L1BridgeSet {
        #[key]
        previous_bridge: felt252,
        #[key]
        new_bridge: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct PolicyGuardSet {
        #[key]
        previous_policy_guard: ContractAddress,
        #[key]
        new_policy_guard: ContractAddress,
    }

    mod Errors {
        pub const L1_BRIDGE_NOT_SET: felt252 = 'L1 bridge not set';
        pub const POLICY_GUARD_NOT_SET: felt252 = 'Policy guard not set';
        pub const INVALID_ADDRESS: felt252 = 'Invalid address';
        pub const UNAUTHORIZED_L1_SENDER: felt252 = 'Unauthorized L1 sender';
        pub const MESSAGE_SEND_FAILED: felt252 = 'Message send failed';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        policy_guard: ContractAddress
    ) {
        self.ownable.initializer(owner);
        self.policy_guard.write(policy_guard);
    }

    #[abi(embed_v0)]
    impl PolicyBridgeImpl of super::IPolicyBridge<ContractState> {
        /// Send policy update from L2 to L1
        /// This allows Starknet to notify Ethereum about policy changes
        fn sync_policy_to_l1(
            ref self: ContractState,
            user: ContractAddress,
            commitment: felt252,
            allowed: bool
        ) {
            // Only owner can send messages to L1
            self.ownable.assert_only_owner();

            // Validate addresses
            assert(!self.l1_bridge_address.read().is_zero(), Errors::L1_BRIDGE_NOT_SET);
            assert(!user.is_zero(), Errors::INVALID_ADDRESS);

            // Build payload for L1
            // Format: [user_address, commitment, allowed (0 or 1)]
            let allowed_felt: felt252 = if allowed { 1 } else { 0 };
            let mut payload = ArrayTrait::new();
            payload.append(user.into());
            payload.append(commitment);
            payload.append(allowed_felt);

            // Send message to L1
            send_message_to_l1_syscall(
                self.l1_bridge_address.read(),
                payload.span()
            ).unwrap_syscall();

            // Track message
            let message_id = self.message_count.read();
            self.messages_sent.write(
                message_id,
                PolicyMessage {
                    user,
                    commitment,
                    allowed,
                    timestamp: starknet::get_block_timestamp(),
                }
            );
            self.message_count.write(message_id + 1);

            self.emit(PolicySyncedToL1 {
                message_id,
                user,
                commitment,
                allowed,
                l1_bridge: self.l1_bridge_address.read(),
            });
        }

        fn set_l1_bridge(ref self: ContractState, l1_bridge_address: felt252) {
            self.ownable.assert_only_owner();
            assert(l1_bridge_address != 0, Errors::INVALID_ADDRESS);

            let previous = self.l1_bridge_address.read();
            self.l1_bridge_address.write(l1_bridge_address);

            self.emit(L1BridgeSet {
                previous_bridge: previous,
                new_bridge: l1_bridge_address,
            });
        }

        fn set_policy_guard(ref self: ContractState, policy_guard: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!policy_guard.is_zero(), Errors::INVALID_ADDRESS);

            let previous = self.policy_guard.read();
            self.policy_guard.write(policy_guard);

            self.emit(PolicyGuardSet {
                previous_policy_guard: previous,
                new_policy_guard: policy_guard,
            });
        }

        fn get_l1_bridge(self: @ContractState) -> felt252 {
            self.l1_bridge_address.read()
        }

        fn get_policy_guard(self: @ContractState) -> ContractAddress {
            self.policy_guard.read()
        }

        fn get_message_count(self: @ContractState) -> u128 {
            self.message_count.read()
        }
    }

    /// L1 Handler: Receive policy updates from Ethereum
    /// This function is called by the Starknet sequencer when a message
    /// is sent from L1
    #[l1_handler]
    fn handle_policy_update(
        ref self: ContractState,
        from_address: felt252,
        user: ContractAddress,
        commitment: felt252,
        allowed: u8
    ) {
        // Verify message is from authorized L1 bridge
        assert(
            from_address == self.l1_bridge_address.read(),
            Errors::UNAUTHORIZED_L1_SENDER
        );

        // Validate inputs
        assert(!user.is_zero(), Errors::INVALID_ADDRESS);
        assert(!self.policy_guard.read().is_zero(), Errors::POLICY_GUARD_NOT_SET);

        // Convert u8 to bool
        let allowed_bool = allowed != 0;

        // Update policy on L2 policy guard
        let policy_guard = IPolicyGuardDispatcher {
            contract_address: self.policy_guard.read()
        };

        policy_guard.set_policy(user, commitment, allowed_bool);

        self.emit(PolicySyncedFromL1 {
            user,
            commitment,
            allowed: allowed_bool,
            from_address,
        });
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _validate_l1_bridge_set(self: @ContractState) {
            assert(
                !self.l1_bridge_address.read().is_zero(),
                Errors::L1_BRIDGE_NOT_SET
            );
        }

        fn _validate_policy_guard_set(self: @ContractState) {
            assert(
                !self.policy_guard.read().is_zero(),
                Errors::POLICY_GUARD_NOT_SET
            );
        }
    }
}
