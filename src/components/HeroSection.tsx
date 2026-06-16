import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import childHero1 from "@/assets/child-hero-1.jpg";
import childHero2 from "@/assets/child-hero-2.jpg";
import rocketImg from "@/assets/rocket.png";
import { KidzyLogo } from "@/components/KidzyLogo";

const HeroSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const rocketX = useTransform(scrollYProgress, [0, 1], ["-20vw", "120vw"]);
  const rocketY = useTransform(scrollYProgress, [0, 1], ["80vh", "-40vh"]);
  const rocketRotate = useTransform(scrollYProgress, [0, 1], [60, -20]);

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -40]);

  return (
    <section ref={ref} className="relative min-h-[74svh] md:min-h-screen flex flex-col items-center justify-center overflow-hidden bg-card">
      {/* Медіатор: підкладка за привітанням */}
      <div
        className="absolute inset-x-[-18%] -top-20 bottom-[4%] md:inset-x-[-10%] md:-top-[150px] md:bottom-[15%] bg-[#f2e4a7]"
        style={{ borderRadius: "0 0 50% 50%" }}
      />

      {/* Летюча ракета */}
      <motion.img
        src={rocketImg}
        alt=""
        style={{
          x: rocketX,
          y: rocketY,
          rotate: rocketRotate,
        }}
        className="fixed w-32 h-32 md:w-56 md:h-56 pointer-events-none z-[100]"
      />
      {/* Decorative star - Left side top */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.1, 0.3, 0.1], y: [0, -15, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-28 left-[15%] hidden md:block text-primary"
      >
        <svg width="40" height="40" viewBox="0 0 40 40">
          <path d="M20 0L24.5 15.5L40 20L24.5 24.5L20 40L15.5 24.5L0 20L15.5 15.5L20 0Z" fill="currentColor" />
        </svg>
      </motion.div>

      {/* Decorative circles - Scatter around */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-48 left-[10%] w-12 h-12 rounded-full border-4 border-accent opacity-20 hidden lg:block"
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 10, repeat: Infinity, delay: 2 }}
        className="absolute bottom-64 right-[12%] w-16 h-16 rounded-full border-4 border-secondary opacity-20 hidden lg:block"
      />

      {/* Floating path/doodle - Right side center */}
      <motion.div
        animate={{ y: [0, 20, 0], x: [0, 5, 0] }}
        transition={{ duration: 7, repeat: Infinity }}
        className="absolute top-[40%] right-[10%] text-secondary opacity-40 hidden md:block"
      >
        <svg width="60" height="40" viewBox="0 0 60 40">
          <path d="M5 20 C15 5 25 35 35 20 C45 5 55 35 65 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
      </motion.div>

      {/* Another sparkle - Bottom right */}
      <motion.div
        animate={{ rotate: 360, opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-40 left-[8%] hidden md:block text-accent"
      >
        <svg width="30" height="30" viewBox="0 0 40 40">
          <path d="M20 0L24.5 15.5L40 20L24.5 24.5L20 40L15.5 24.5L0 20L15.5 15.5L20 0Z" fill="currentColor" />
        </svg>
      </motion.div>

      {/* Small bird/arrow doodle top-right - Rotated right */}
      <motion.svg
        animate={{ x: [0, 10, 0], y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity }}
        style={{ transform: 'rotate(90deg)' }}
        className="absolute top-36 right-[22%] w-8 h-8 text-foreground opacity-25 hidden md:block" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2"
      >
        <path d="M5 20 L15 10 L25 20" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 25 L15 18 L22 25" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>

      {/* Small doodle marks bottom-left */}
      <motion.svg
        animate={{ x: [0, -10, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 9, repeat: Infinity }}
        className="absolute bottom-48 left-[22%] w-10 h-8 text-secondary opacity-60 hidden md:block" viewBox="0 0 40 20" fill="none" stroke="currentColor" strokeWidth="2.5"
      >
        <path d="M2 18 Q10 2 20 10 Q30 18 38 4" strokeLinecap="round" />
      </motion.svg>

      <div className="relative z-10 text-center px-4 max-w-4xl -mt-[6vh] md:-mt-[15vh]">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="text-muted-foreground font-semibold mb-4 text-lg"
        >
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="mb-4 md:mb-6 flex flex-col items-center gap-2 md:gap-3"
        >
          <KidzyLogo className="h-24 md:h-40 lg:h-52" />
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-sm md:text-xl lg:text-2xl font-semibold tracking-widest text-foreground/70 uppercase"
          >
            SoloWay Montessori playroom
          </motion.p>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl text-foreground font-normal font-hero leading-tight relative inline-block mt-5 md:mt-12"
        >
          {/* Squiggly decoration */}
          <div className="absolute -left-6 md:-left-12 top-6 md:top-12 -z-10 opacity-60">
            <svg width="80" height="30" viewBox="0 0 100 40">
              <path d="M5 25C15 15 25 35 35 25C45 15 55 35 65 25C75 15 85 35 95 25" stroke="hsl(var(--warm-yellow))" strokeWidth="8" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          ДИТЯЧИЙ ПРОСТІР <br /> МОНТЕРОССОРІ
        </motion.h1>

        {/* Scroll arrow - more prominent */}
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: [0, 10, 0] }}
          transition={{
            delay: 0.6,
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="mt-10 md:mt-16 text-primary flex flex-col items-center gap-2 md:gap-3"
        >
          <span className="text-[10px] uppercase font-bold tracking-[0.3em] opacity-60">Гортайте вниз</span>
          <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </div>

      {/* Left organic photo */}
      <motion.div
        style={{ y: y1 }}
        className="absolute left-[3%] bottom-[15%] hidden md:block"
      >
        <motion.div
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative"
        >
          <div className="absolute -bottom-4 -left-4 w-full h-full bg-secondary organic-shape z-0" />
          <div className="relative z-10 w-56 h-56 lg:w-64 lg:h-64 overflow-hidden organic-shape border-8 border-card shadow-xl">
            <img src={childHero1} alt="Дитина грається" className="w-full h-full object-cover" width={600} height={600} />
          </div>
        </motion.div>
      </motion.div>

      {/* Right organic photo */}
      <motion.div
        style={{ y: y2 }}
        className="absolute right-[3%] bottom-[10%] hidden md:block"
      >
        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative"
        >
          <div className="absolute -bottom-4 -right-4 w-full h-full bg-accent organic-shape z-0" />
          <div className="relative z-10 w-56 h-56 lg:w-64 lg:h-64 overflow-hidden organic-shape border-8 border-card shadow-xl">
            <img src={childHero2} alt="Дівчинка в капелюсі" className="w-full h-full object-cover" width={600} height={600} />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
