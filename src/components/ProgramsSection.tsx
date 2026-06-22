import { motion } from "framer-motion";

const programs = [
  {
    title: "Цілий день",
    price: "1390 грн",
    description: "коли потрібно встигнути все",
  },
  {
    title: "Адаптація",
    price: "300 грн",
    description:
      "Перші дні ти поруч, а дитина звикає до простору у своєму темпі. Ми підготували для вас документ, у якому наші педагоги прописали, як м'яко підготувати дитину до цього важливого дня",
  },
  {
    title: "На 3 години",
    price: "850 грн",
    description: "найпопулярніший формат серед мам",
  },
  {
    title: "На 1 годину",
    price: "500 грн",
    description: "для кави, зустрічі, тренування чи просто тиші",
  },
];

const ProgramsSection = () => {
  return (
    <section id="programs" className="relative py-16 md:py-32 overflow-hidden bg-white md:mt-12">
      {/* Pink arch - mediator upwards */}
      <div 
        className="absolute inset-x-[-50%] md:inset-x-[-10%] top-0 h-full bg-secondary" 
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
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-foreground mb-4 leading-tight">
            Формати відвідування
          </h2>
          <svg className="mx-auto mt-2 w-24 h-4 text-foreground/40" viewBox="0 0 100 15">
            <path d="M5 8 Q20 2 35 10 Q50 18 65 8 Q80 -2 95 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </motion.div>

        <div className="grid auto-rows-fr md:grid-cols-2 gap-5 md:gap-6 max-w-4xl mx-auto mt-8 md:mt-14 items-stretch">
          {programs.map((program, index) => (
            <motion.div
              key={program.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="bg-card rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-7 shadow-lg border border-white/70 flex h-full min-h-[260px] md:min-h-[300px] flex-col"
            >
              <div className="flex flex-col gap-4">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground leading-tight">
                  {program.title}
                </h3>
                <div className="w-fit rounded-full bg-primary/35 px-4 py-2 text-base sm:text-lg md:text-xl font-bold text-foreground">
                  {program.price}
                </div>
              </div>
              <p className="mt-5 text-muted-foreground text-sm sm:text-base md:text-lg leading-relaxed font-medium">
                {program.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProgramsSection;
