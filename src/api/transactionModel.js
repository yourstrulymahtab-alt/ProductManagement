// This file defines the transaction model structure for reference
// Example transaction object:
// {
//   id: 1,
//   product_id: 1,
//   quantity: 10,
//   actualPrice: 15, // calculated from product cp or sp
//   transactionPrice: 16, // price at which it is bought/sold (user input)
//   totalPrice: 160, // transactionPrice * quantity
//   amountPaid: 160, // user input
//   transaction_type: 'buy' | 'sell',
//   person_name: 'John',
//   contact: '1234567890',
//   transaction_date: ...
// }
