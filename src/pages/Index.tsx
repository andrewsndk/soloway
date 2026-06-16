import { useState } from "react";
import Loader from "@/components/Loader";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import WhyMontessoriSection from "@/components/WhyMontessoriSection";
import MissionSection from "@/components/MissionSection";
import ProgramsSection from "@/components/ProgramsSection";
import TestimonialSection from "@/components/TestimonialSection";
import BookingSection from "@/components/BookingSection";
import FooterSection from "@/components/FooterSection";

const Index = () => {
  const [loading, setLoading] = useState(true);

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
        </>
      )}
    </div>
  );
};

export default Index;
