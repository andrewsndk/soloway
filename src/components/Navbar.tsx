import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="container flex items-center justify-end px-6 md:px-12 py-8">
        {/* Hamburger menu icon */}
        <button
          onClick={() => setOpen(!open)}
          className="flex flex-col gap-1.5 group bg-white/40 p-3 rounded-xl backdrop-blur-md shadow-sm hover:bg-white/60 transition-all z-50"
        >
          <span className={`block w-8 h-0.5 bg-foreground transition-transform ${open ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-8 h-0.5 bg-foreground transition-opacity ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-8 h-0.5 bg-foreground transition-transform ${open ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-background border-t border-border overflow-hidden shadow-2xl"
          >
            <div className="flex flex-col gap-4 px-6 py-8 container">
              <a href="#about" onClick={() => setOpen(false)} className="text-foreground font-bold text-xl hover:text-primary transition-colors">Про нас</a>
              <a href="#programs" onClick={() => setOpen(false)} className="text-foreground font-bold text-xl hover:text-primary transition-colors">Програми</a>
              <a href="#contact" onClick={() => setOpen(false)} className="text-foreground font-bold text-xl hover:text-primary transition-colors">Контакти</a>
              <a href="#contact" onClick={() => setOpen(false)} className="bg-primary text-primary-foreground mt-2 px-8 py-4 rounded-full text-lg font-bold text-center shadow-lg hover:opacity-90 transition-opacity">
                Записатися
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
