import { createContext, useContext, useState, useEffect } from 'react';
import { getCart, addToCart as apiAdd, updateCartItem, removeFromCart as apiRemove, clearCart as apiClear } from '../utils/api';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';

const CartContext = createContext();
const safeArr = (d) => Array.isArray(d) ? d : [];

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) fetchCart();
    else setCart([]);
  }, [user]);

  const fetchCart = async () => {
    try {
      const { data } = await getCart();
      const mappedLines = safeArr(data?.lines).map(line => ({
        ...line,
        product: {
          _id: line.product_id,
          name: line.product_title,
          images: line.image ? [line.image] : [],
          brand: line.seller_name,
          price: line.unit_price ? line.unit_price.amount_minor / 100 : 0,
          mrp: line.unit_price ? line.unit_price.amount_minor / 100 : 0,
        }
      }));
      setCart(mappedLines);
    } catch { setCart([]); }
  };

  const addItem = async (productId, quantity = 1, size = '', color = '') => {
    if (!user) { toast.info('Please login to add items'); return false; }
    setLoading(true);
    try {
      await apiAdd(productId, quantity);
      await fetchCart();
      toast.success('Added to cart!');
      return true;
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to add');
      return false;
    } finally { setLoading(false); }
  };

  const updateItem = async (itemId, quantity) => {
    try {
      await updateCartItem(itemId, quantity);
      await fetchCart();
    } catch {}
  };

  const removeItem = async (itemId) => {
    try {
      await apiRemove(itemId);
      await fetchCart();
      toast.info('Removed from cart');
    } catch {}
  };

  const clearCartItems = async () => {
    try { await apiClear(); setCart([]); } catch {}
  };

  const cartCount = cart.reduce((s, i) => s + (i.quantity || 0), 0);
  const cartTotal = cart.reduce((s, i) => s + (i.product?.price || 0) * (i.quantity || 0), 0);
  const cartMrp = cart.reduce((s, i) => s + (i.product?.original_price || i.product?.mrp || i.product?.price || 0) * (i.quantity || 0), 0);
  const discount = cartMrp > cartTotal ? cartMrp - cartTotal : 0;

  return (
    <CartContext.Provider value={{ cart, loading, cartCount, cartTotal, cartMrp, discount, addItem, updateItem, removeItem, clearCartItems, fetchCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
