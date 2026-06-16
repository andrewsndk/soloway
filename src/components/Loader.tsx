import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const Loader = ({ onFinish }: { onFinish: () => void }) => {
  const [isVisible, setIsVisible] = useState(true);

  // Функція для завершення лоадера
  const handleFinish = () => {
    setIsVisible(false);
    setTimeout(onFinish, 1000); // Час на анімацію зникнення
  };

  useEffect(() => {
    const timer = setTimeout(handleFinish, 3000); // Завершити лоадер через 3 секунди
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="fixed inset-0 z-[9999] bg-[#f0dd9d] flex items-center justify-center overflow-hidden p-10"
        >
          <img
            src="/videos/video.gif"
            alt="Loading..."
            className="w-[70vw] md:w-[30vw] max-w-[380px] block mx-auto"
            style={{ clipPath: "inset(0 0 15% 0)" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Loader;
