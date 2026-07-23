"use client";

export type CartItem = { variantId: string; slug: string; name: string; variant: string; unitPrice: number; quantity: number };

const KEY = "et_cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

export function setCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-changed"));
}

export function addToCart(item: Omit<CartItem, "quantity">, qty = 1) {
  const cart = getCart();
  const existing = cart.find((c) => c.variantId === item.variantId);
  if (existing) existing.quantity = Math.min(existing.quantity + qty, 5);
  else cart.push({ ...item, quantity: qty });
  setCart(cart);
}

export function cartCount() {
  return getCart().reduce((s, c) => s + c.quantity, 0);
}
