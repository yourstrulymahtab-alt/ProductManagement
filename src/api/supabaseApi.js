// src/api/supabaseApi.js
import { supabase } from './supabaseClient';

// PRODUCTS
export const getProducts = async () => {
  const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true });
  if (error) throw error;
  return data;
};

export const addProduct = async (product) => {
  const { error } = await supabase.from('products').insert([product]);
  if (error) throw error;
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
  // Insert transaction
  const { error } = await supabase.from('transactions').insert([txn]);
  if (error) throw error;
  // Update product stock
  const { data: product } = await supabase.from('products').select('stock').eq('id', txn.product_id).single();
  if (!product) throw new Error('Product not found');
  let newStock = product.stock;
  if (txn.transaction_type === 'buy') {
    newStock += txn.quantity;
  } else if (txn.transaction_type === 'sell') {
    newStock -= txn.quantity;
  }
  const { error: stockError } = await supabase.from('products').update({ stock: newStock }).eq('id', txn.product_id);
  if (stockError) throw stockError;
};

export const clearTransactions = async () => {
  const { error } = await supabase.from('transactions').delete();
  if (error) throw error;
};
