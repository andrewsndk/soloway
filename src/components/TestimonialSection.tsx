import { motion } from "framer-motion";
import { KidzyLogo } from "@/components/KidzyLogo";

const TestimonialSection = () => {
  return (
    <section className="relative py-12 md:py-24 overflow-hidden bg-background">
      <div className="container relative z-10 px-4">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12 max-w-4xl mx-auto">
          {/* Logo instead of photo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex-shrink-0"
          >
            <div className="w-36 h-36 md:w-56 md:h-56 flex items-center justify-center overflow-hidden organic-shape border-8 border-card shadow-xl bg-accent">
              <KidzyLogo className="h-24 md:h-32 w-auto" />
            </div>
          </motion.div>

          {/* New text */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex-1"
          >
            <p className="text-foreground text-lg md:text-2xl leading-relaxed font-medium text-center md:text-left">
              Ваші історії — це натхнення для нас. Чекаємо на ваші відгуки, щоб розділити ці моменти з іншими.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialSection;
