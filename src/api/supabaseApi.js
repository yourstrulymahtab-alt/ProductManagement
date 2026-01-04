// src/api/supabaseApi.js
import { supabase } from './supabaseClient';

// PRODUCTS
export const getProducts = async () => {
  const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true });
  if (error) throw error;
  return data;
};

// Add or update product
export const addProduct = async (product) => {
  if (product.isEdit && product.id) {
    // Remove isEdit before update
    const { id, isEdit: _isEdit, ...updateFields } = product;
    const { error } = await supabase.from('products').update(updateFields).eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('products').insert([product]);
    if (error) throw error;
  }
};

export const deleteProduct = async (id) => {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
};

// TRANSACTIONS
export const getTransactions = async () => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, product:products(name)')
    .order('id', { ascending: false });
  if (error) throw error;
  // Attach product name for convenience
  return data.map(t => ({ ...t, productName: t.product?.name || '', product: undefined }));
};

export const addTransaction = async (txn) => {
  if (txn.id) {
    // Update transaction
    // First, get the current transaction to check for changes
    const { data: currentTxn, error: fetchErr } = await supabase.from('transactions').select('*').eq('id', txn.id).single();
    if (fetchErr) throw fetchErr;
    if (!currentTxn) throw new Error('Transaction not found');

    const { id, ...updateFields } = txn;
    const { error } = await supabase.from('transactions').update(updateFields).eq('id', id);
    if (error) throw error;

    // If amountPaid changed, record adjustment
    if (updateFields.amountPaid !== undefined && updateFields.amountPaid !== currentTxn.amount_paid) {
      await addLedgerAdjustment({
        person_name: currentTxn.person_name,
        contact: currentTxn.contact,
        adjustment_amount: updateFields.amountPaid - currentTxn.amount_paid,
        adjustment_date: new Date().toISOString(),
        reason: 'Manual adjustment'
      });
    }
  } else {
    // For sell transactions, check stock before inserting
    if (txn.transaction_type === 'sell') {
      const { data: product, error: prodErr } = await supabase.from('products').select('stock').eq('id', txn.product_id).single();
      if (prodErr) throw prodErr;
      if (!product) throw new Error('Product not found');
      if (product.stock < txn.quantity) {
        throw new Error('Insufficient stock');
      }
    }
    // Insert transaction
    const { error: insertErr } = await supabase.from('transactions').insert([txn]);
    if (insertErr) throw insertErr;
    // Update product stock
    const { data: product, error: prodErr } = await supabase.from('products').select('stock').eq('id', txn.product_id).single();
    if (prodErr) throw prodErr;
    if (!product) throw new Error('Product not found');
    let newStock = product.stock;
    if (txn.transaction_type === 'return') {
      newStock += txn.quantity;
    } else if (txn.transaction_type === 'sell') {
      newStock -= txn.quantity;
    }
    const { error: stockError } = await supabase.from('products').update({ stock: newStock }).eq('id', txn.product_id);
    if (stockError) throw stockError;
  }
};

// Reverse a transaction: adjust product stock in the opposite direction and mark transaction as reversed
export const reverseTransaction = async (txnId) => {
  // Load transaction
  const { data: txn, error: txnErr } = await supabase.from('transactions').select('*').eq('id', txnId).single();
  if (txnErr) throw txnErr;
  if (!txn) throw new Error('Transaction not found');
  if (txn.reversed) throw new Error('Transaction already reversed');

  // Load product
  const { data: product, error: prodErr } = await supabase.from('products').select('stock').eq('id', txn.product_id).single();
  if (prodErr) throw prodErr;
  if (!product) throw new Error('Product not found');

  let newStock = product.stock;
  if (txn.transaction_type === 'sell') {
    // Sell reversed -> add quantity back
    newStock += txn.quantity;
  } else if (txn.transaction_type === 'return') {
    // Return reversed -> remove quantity from stock
    newStock -= txn.quantity;
    if (newStock < 0) {
      throw new Error('Cannot reverse return transaction because product stock would become negative');
    }
  }

  const { error: stockError } = await supabase.from('products').update({ stock: newStock }).eq('id', txn.product_id);
  if (stockError) throw stockError;

  // Mark transaction as reversed (and store timestamp)
  const { error: updateErr } = await supabase.from('transactions').update({ reversed: true, reversed_at: new Date().toISOString() }).eq('id', txnId);
  if (updateErr) throw updateErr;

  return true;
};

export const clearTransactions = async () => {
  const { error } = await supabase.from('transactions').delete();
  if (error) throw error;
};

export const getUniqueCustomers = async () => {
  const { data, error } = await supabase
    .from('transactions')
    .select('person_name, contact')
    .neq('person_name', null)
    .neq('contact', null);
  if (error) throw error;
  // Deduplicate by name/contact
  const seen = new Set();
  const unique = [];
  for (const row of data) {
    const key = `${row.person_name}|${row.contact}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(row);
    }
  }
  return unique;
};

// LEDGER ADJUSTMENTS
export const getLedgerAdjustments = async (personName, contact) => {
  const { data, error } = await supabase
    .from('ledger_adjustments')
    .select('*')
    .eq('person_name', personName)
    .eq('contact', contact)
    .order('adjustment_date', { ascending: false });
  if (error) throw error;
  return data;
};

export const addLedgerAdjustment = async (adjustment) => {
  const { error } = await supabase.from('ledger_adjustments').insert([adjustment]);
  if (error) throw error;
};