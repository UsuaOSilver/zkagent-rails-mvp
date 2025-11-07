#[starknet::contract]
mod policy_guard {
    use starknet::ContractAddress;
    use starknet::storage::Map;

    #[storage]
    struct Storage {
        // Optional "attester" you can use later; not enforced in MVP.
        attester: ContractAddress,
        // Map (user, commitment) -> 0/1
        policy: Map<(ContractAddress, felt252), u8>,
    }

    #[constructor]
    fn constructor(ref self: ContractState, a: ContractAddress) {
        self.attester.write(a);
    }

    /// Set whether `user` is allowed for a given `commitment` (hashed plan).
    /// MVP keeps this open (no attester check) to keep things simple.
    #[external(v0)]
    fn set_policy(ref self: ContractState, user: ContractAddress, commitment: felt252, allowed: bool) {
        let v: u8 = if allowed { 1_u8 } else { 0_u8 };
        self.policy.write((user, commitment), v);
    }

    /// View: returns true if allowed
    #[external(v0)]
    fn check_policy(self: @ContractState, user: ContractAddress, commitment: felt252) -> bool {
        let v: u8 = self.policy.read((user, commitment));
        v != 0_u8
    }
}
