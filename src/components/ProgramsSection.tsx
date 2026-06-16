import { motion } from "framer-motion";
import chalkRainbow from "@/assets/chalk-rainbow.png";
import chalkSun from "@/assets/chalk-sun.png";

const ProgramsSection = () => {
  return (
    <section id="programs" className="relative py-16 md:py-32 overflow-hidden bg-white md:mt-12">
      {/* Pink arch - mediator upwards */}
      <div 
        className="absolute inset-x-[-20%] md:inset-x-[-10%] top-0 h-full bg-secondary" 
        style={{ borderRadius: "50% 50% 0 0" }}
      />

      <div className="container relative z-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 md:mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-extrabold text-foreground mb-4">
            Наші програми
          </h2>
          <svg className="mx-auto mt-2 w-24 h-4 text-foreground/40" viewBox="0 0 100 15">
            <path d="M5 8 Q20 2 35 10 Q50 18 65 8 Q80 -2 95 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5 md:gap-8 max-w-3xl mx-auto mt-8 md:mt-16">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-card rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 shadow-lg flex flex-col items-center"
          >
            <img src={chalkRainbow} alt="Веселка" className="w-24 h-24 md:w-28 md:h-28 mb-3 md:mb-4" loading="lazy" width={512} height={512} />
            <h3 className="text-xl font-bold text-foreground mb-2">Група 2–4 роки</h3>
            <p className="text-muted-foreground text-sm text-center">Сенсорний розвиток, практичні життєві навички, перші кроки до самостійності</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="bg-card rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 shadow-lg flex flex-col items-center"
          >
            <img src={chalkSun} alt="Сонце" className="w-24 h-24 md:w-28 md:h-28 mb-3 md:mb-4" loading="lazy" width={512} height={512} />
            <h3 className="text-xl font-bold text-foreground mb-2">Група 4–6 років</h3>
            <p className="text-muted-foreground text-sm text-center">Математика, мова, культура й наука через спеціальні матеріали Монтессорі</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProgramsSection;
