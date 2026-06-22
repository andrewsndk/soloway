import { useState, useEffect } from "react";
import Loader from "@/components/Loader";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import WhyMontessoriSection from "@/components/WhyMontessoriSection";
import MissionSection from "@/components/MissionSection";
import ProgramsSection from "@/components/ProgramsSection";
import TestimonialSection from "@/components/TestimonialSection";
import BookingSection from "@/components/BookingSection";
import FooterSection from "@/components/FooterSection";
import { Calendar } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const contactEl = document.getElementById("contact");
      const isScrolledDown = window.scrollY > 400;

      if (contactEl) {
        const contactRect = contactEl.getBoundingClientRect();
        // Hide button if contact section is visible in the viewport
        const isContactVisible = contactRect.top < window.innerHeight;
        
        setShowScrollBtn(isScrolledDown && !isContactVisible);
      } else {
        setShowScrollBtn(isScrolledDown);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background transition-opacity duration-1000">
      <Loader onFinish={() => setLoading(false)} />
      {!loading && (
        <>
          <Navbar />
          <HeroSection />
          <WhyMontessoriSection />
          <MissionSection />
          <ProgramsSection />
          <TestimonialSection />
          <BookingSection />
          <FooterSection />

          <AnimatePresence>
            {showScrollBtn && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 50 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="fixed bottom-6 right-6 z-50 bg-primary text-white font-extrabold px-6 py-4 rounded-full shadow-2xl flex items-center gap-2 border-2 border-white/80 hover:bg-primary/95 transition-colors text-sm sm:text-base"
              >
                <Calendar className="w-5 h-5" />
                <span>Забронювати візит</span>
              </motion.button>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default Index;
