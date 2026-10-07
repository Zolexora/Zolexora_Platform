import { createContext, useContext, useState, useEffect } from 'react';
import { getWishlist, toggleWishlist as apiToggle } from '../utils/api';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';

const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState([]);

  useEffect(() => {
    if (user) fetchWishlist();
    else setWishlist([]);
  }, [user]);

  const fetchWishlist = async () => {
    try {
      const { data } = await getWishlist();
      setWishlist(Array.isArray(data) ? data : []);
    } catch { setWishlist([]); }
  };

  const toggle = async (productId) => {
    if (!user) { toast.info('Please login to save items'); return; }
    try {
      const { data } = await apiToggle(productId);
      setWishlist(Array.isArray(data.wishlist) ? data.wishlist : []);
      toast.success(data.added ? 'Added to wishlist!' : 'Removed from wishlist');
    } catch {}
  };

  const isInWishlist = (productId) =>
    wishlist.some(p => (p._id || p) === productId);

  return (
    <WishlistContext.Provider value={{ wishlist, toggle, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => useContext(WishlistContext);
