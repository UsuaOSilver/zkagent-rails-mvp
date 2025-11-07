#[starknet::contract]
mod merchant_receipts {
    use starknet::ContractAddress;

    #[storage]
    struct Storage {}

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Receipt: Receipt
    }

    #[derive(Drop, starknet::Event)]
    struct Receipt {
        payer: ContractAddress,
        merchant: ContractAddress,
        token_in: ContractAddress,
        token_out: ContractAddress,
        amount_in: u256,
        amount_out: u256,
        nullifier_hash: felt252,
        epoch: u128,
        policy_hash: felt252
    }

    #[external(v0)]
    fn emit_receipt(
        ref self: ContractState,
        payer: ContractAddress,
        merchant: ContractAddress,
        token_in: ContractAddress,
        token_out: ContractAddress,
        amount_in: u256,
        amount_out: u256,
        nullifier_hash: felt252,
        epoch: u128,
        policy_hash: felt252
    ) {
        self.emit(Receipt {
            payer, merchant, token_in, token_out,
            amount_in, amount_out, nullifier_hash, epoch, policy_hash
        });
    }
}
