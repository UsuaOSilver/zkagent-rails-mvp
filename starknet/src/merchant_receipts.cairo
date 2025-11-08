use starknet::ContractAddress;

// Export StoredReceipt for use by other contracts
#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct StoredReceipt {
    pub payer: ContractAddress,
    pub merchant: ContractAddress,
    pub token_in: ContractAddress,
    pub token_out: ContractAddress,
    pub amount_in: u256,
    pub amount_out: u256,
    pub nullifier_hash: felt252,
    pub epoch: u128,
    pub policy_hash: felt252,
    pub timestamp: u64,
}

#[starknet::interface]
trait IMerchantReceipts<TContractState> {
    fn emit_receipt(
        ref self: TContractState,
        payer: ContractAddress,
        merchant: ContractAddress,
        token_in: ContractAddress,
        token_out: ContractAddress,
        amount_in: u256,
        amount_out: u256,
        nullifier_hash: felt252,
        epoch: u128,
        policy_hash: felt252
    );
    fn get_receipt(self: @TContractState, receipt_id: u128) -> StoredReceipt;
    fn get_receipt_count(self: @TContractState) -> u128;
    fn get_merchant_receipt_count(self: @TContractState, merchant: ContractAddress) -> u128;
    fn get_merchant_receipt_at_index(
        self: @TContractState,
        merchant: ContractAddress,
        index: u128
    ) -> StoredReceipt;
    fn get_payer_receipt_count(self: @TContractState, payer: ContractAddress) -> u128;
    fn get_payer_receipt_at_index(
        self: @TContractState,
        payer: ContractAddress,
        index: u128
    ) -> StoredReceipt;
    fn get_merchant_total_volume(self: @TContractState, merchant: ContractAddress) -> u256;
}

#[starknet::contract]
mod merchant_receipts {
    use starknet::ContractAddress;
    use starknet::get_block_timestamp;
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess
    };
    use core::num::traits::Zero;

    // Import OpenZeppelin Ownable for access control (optional, for admin functions)
    use openzeppelin::access::ownable::OwnableComponent;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    // Import from parent module
    use super::StoredReceipt;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        // Total number of receipts
        receipt_count: u128,
        // receipt_id => Receipt
        receipts: Map<u128, StoredReceipt>,
        // (merchant, index) => receipt_id
        merchant_receipts: Map<(ContractAddress, u128), u128>,
        // (payer, index) => receipt_id
        payer_receipts: Map<(ContractAddress, u128), u128>,
        // merchant => count
        merchant_receipt_count: Map<ContractAddress, u128>,
        // payer => count
        payer_receipt_count: Map<ContractAddress, u128>,
        // Total merchant volume: merchant => total_amount
        merchant_total_volume: Map<ContractAddress, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Receipt: Receipt,
    }

    // Event with indexed parameters for efficient querying
    #[derive(Drop, starknet::Event)]
    struct Receipt {
        #[key]
        receipt_id: u128,
        #[key]
        payer: ContractAddress,
        #[key]
        merchant: ContractAddress,
        #[key]
        epoch: u128,
        token_in: ContractAddress,
        token_out: ContractAddress,
        amount_in: u256,
        amount_out: u256,
        nullifier_hash: felt252,
        policy_hash: felt252,
        #[key]
        timestamp: u64,
    }

    mod Errors {
        pub const INVALID_ADDRESS: felt252 = 'Invalid address';
        pub const INVALID_AMOUNT: felt252 = 'Amount must be > 0';
        pub const RECEIPT_NOT_FOUND: felt252 = 'Receipt not found';
        pub const INDEX_OUT_OF_BOUNDS: felt252 = 'Index out of bounds';
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);
    }

    #[abi(embed_v0)]
    impl MerchantReceiptsImpl of super::IMerchantReceipts<ContractState> {
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
            // Validation
            assert(!payer.is_zero(), Errors::INVALID_ADDRESS);
            assert(!merchant.is_zero(), Errors::INVALID_ADDRESS);
            assert(amount_in > 0, Errors::INVALID_AMOUNT);

            let receipt_id = self.receipt_count.read();
            let timestamp = get_block_timestamp();

            // Store receipt
            let receipt = StoredReceipt {
                payer,
                merchant,
                token_in,
                token_out,
                amount_in,
                amount_out,
                nullifier_hash,
                epoch,
                policy_hash,
                timestamp,
            };

            self.receipts.write(receipt_id, receipt);

            // Index by merchant
            let merchant_idx = self.merchant_receipt_count.read(merchant);
            self.merchant_receipts.write((merchant, merchant_idx), receipt_id);
            self.merchant_receipt_count.write(merchant, merchant_idx + 1);

            // Index by payer
            let payer_idx = self.payer_receipt_count.read(payer);
            self.payer_receipts.write((payer, payer_idx), receipt_id);
            self.payer_receipt_count.write(payer, payer_idx + 1);

            // Update merchant volume
            let current_volume = self.merchant_total_volume.read(merchant);
            self.merchant_total_volume.write(merchant, current_volume + amount_in);

            // Increment receipt count
            self.receipt_count.write(receipt_id + 1);

            // Emit event with indexed parameters
            self.emit(Receipt {
                receipt_id,
                payer,
                merchant,
                token_in,
                token_out,
                amount_in,
                amount_out,
                nullifier_hash,
                epoch,
                policy_hash,
                timestamp,
            });
        }

        fn get_receipt(self: @ContractState, receipt_id: u128) -> StoredReceipt {
            let receipt = self.receipts.read(receipt_id);
            assert(!receipt.payer.is_zero(), Errors::RECEIPT_NOT_FOUND);
            receipt
        }

        fn get_receipt_count(self: @ContractState) -> u128 {
            self.receipt_count.read()
        }

        fn get_merchant_receipt_count(self: @ContractState, merchant: ContractAddress) -> u128 {
            self.merchant_receipt_count.read(merchant)
        }

        fn get_merchant_receipt_at_index(
            self: @ContractState,
            merchant: ContractAddress,
            index: u128
        ) -> StoredReceipt {
            let count = self.merchant_receipt_count.read(merchant);
            assert(index < count, Errors::INDEX_OUT_OF_BOUNDS);

            let receipt_id = self.merchant_receipts.read((merchant, index));
            self.receipts.read(receipt_id)
        }

        fn get_payer_receipt_count(self: @ContractState, payer: ContractAddress) -> u128 {
            self.payer_receipt_count.read(payer)
        }

        fn get_payer_receipt_at_index(
            self: @ContractState,
            payer: ContractAddress,
            index: u128
        ) -> StoredReceipt {
            let count = self.payer_receipt_count.read(payer);
            assert(index < count, Errors::INDEX_OUT_OF_BOUNDS);

            let receipt_id = self.payer_receipts.read((payer, index));
            self.receipts.read(receipt_id)
        }

        fn get_merchant_total_volume(self: @ContractState, merchant: ContractAddress) -> u256 {
            self.merchant_total_volume.read(merchant)
        }
    }
}
