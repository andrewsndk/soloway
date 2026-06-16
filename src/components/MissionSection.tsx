import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import gameImg from "@/assets/game2.png";

const MissionSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imgY = useTransform(scrollYProgress, [0, 1], [60, -60]);

  return (
    <section ref={ref} className="py-12 md:py-24 overflow-hidden bg-card">
      <div className="container px-4">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-20">
          {/* Image with organic shape - now using gameImg instead of childHero2 */}
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative flex-shrink-0"
          >
            <motion.div style={{ y: imgY }} className="relative">
              <div className="absolute -bottom-4 -left-4 w-full h-full bg-secondary organic-shape z-0" />
              <div className="relative z-10 w-[min(19rem,82vw)] h-[24rem] md:w-[32rem] md:h-[36rem] overflow-hidden organic-shape border-8 border-card shadow-xl">
                <img src={gameImg} alt="Дитячий простір" className="w-full h-full object-cover" loading="lazy" />
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex-1 max-w-xl relative pb-4 md:pb-12"
          >
            <h2 className="text-3xl md:text-5xl font-extrabold text-foreground leading-tight mb-5 md:mb-8">
              Філософія <br /> нашого простору
            </h2>
            <div className="space-y-4 md:space-y-6">
              <p className="text-muted-foreground leading-relaxed text-base md:text-lg text-left">
                SoloWay Montessori playroom — це теплий, безпечний простір у ЖК Great, де дитину приймають такою, як вона є 🤍<br /><br />
                Тут вона вільно досліджує світ у своєму темпі, а дорослі м’яко підтримують і допомагають відкривати нове — без тиску, оцінок і поспіху.<br /><br />
                Ми поруч не лише з дітьми, а й з батьками — щоб зняти тривоги, дати відчуття опори й впевненості.
              </p>
              <p className="text-muted-foreground leading-relaxed text-base md:text-lg italic md:pr-12">
                Бо найважливіше — це турбота, довіра і радість бути собою.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default MissionSection;
