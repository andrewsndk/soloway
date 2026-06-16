import { motion } from "framer-motion";
import birdFootprints from "@/assets/bird-footprints.png";
import wallImg from "@/assets/wall.png";

const benefits = [
  {
    num: "1",
    title: "Свобода у підготовленому просторі",
    desc: "Ми не вчимо дитину «бути зручною». Ми готуємо середовище, де вона вільна вибирати, помилятися і знаходити рішення самостійно. Тут кожен предмет має сенс, а кожен крок — це шлях до впевненості.",
  },
  {
    num: "2",
    title: "Мистецтво маленьких справ",
    desc: "За великими досягненнями стоять прості щоденні дії. В Монтессорі ми цінуємо процес вище результату. Дитина вчиться відчувати ритм життя, розвиває фокус і знаходить радість у тому, що зроблено власноруч.",
  },
  {
    num: "3",
    title: "Повага як фундамент",
    desc: "Це більше, ніж метод навчання. Це філософія, де особистість дитини — найвища цінність. Ми не квапимо дорослішання, а дбайливо супроводжуємо природний розвиток, створюючи умови для щасливого «я можу сам».",
  },
];
const WhyMontessoriSection = () => {
  return (
    <section id="about" className="relative bg-white px-3 sm:px-4 md:px-12 pb-10 md:pb-24 pt-16 md:pt-48 -mt-1">
      {/* Плавний перехід від hero */}
      <div
        className="absolute inset-x-0 -top-1 h-16 md:h-48 bg-white"
        style={{ borderRadius: "0 0 50% 50% / 0 0 100% 100%" }}
      />
      <div className="max-w-7xl mx-auto bg-secondary rounded-[2rem] md:rounded-[5rem] px-4 py-8 sm:p-8 md:p-24 relative shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
        {/* Wall Image Decoration - Floating on the edge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="absolute -top-12 md:-top-36 left-1/2 -translate-x-1/2 z-20 w-full max-w-[140px] md:max-w-[370px] pointer-events-none"
        >
          <img src={wallImg} alt="" className="w-full object-contain filter drop-shadow-xl" />
        </motion.div>

        {/* Заголовок — тепер білий блок */}
        <div className="relative text-center mb-12 md:mb-28">
          <div className="mx-auto max-w-4xl bg-white rounded-[1.5rem] md:rounded-[3rem] py-8 md:py-20 px-4 md:px-10 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
            <div className="relative inline-block">
              <div className="absolute -top-10 md:-top-14 left-1/2 -translate-x-1/2 text-foreground/50">
                <svg width="60" height="40" viewBox="0 0 60 40" fill="none">
                  <path d="M10 35L5 20M30 25L30 5M50 35L55 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="text-3xl md:text-6xl font-extrabold text-foreground leading-tight"
              >
                Чому обирають <br /> метод Монтессорі?
              </motion.h2>
            </div>
          </div>
        </div>

        {/* 1-2-3 features with footprint connectors */}
        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-10 md:gap-20">
          {benefits.map((b, i) => (
            <motion.div
              key={b.num}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="flex flex-col items-center text-center relative px-1 sm:px-4 md:px-6"
            >
              <div className="w-14 h-14 md:w-[70px] md:h-[70px] border-[1.5px] border-foreground rounded-full flex items-center justify-center font-medium text-xl md:text-2xl bg-card relative z-10 mb-5 md:mb-10">
                {b.num}
              </div>
              <h3 className="text-lg font-bold text-foreground mb-3">{b.title}</h3>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed font-medium">{b.desc}</p>

              {/* Footprint connectors — walking trail */}
              {i < benefits.length - 1 && (
                <div className="hidden md:flex absolute top-8 left-[65%] w-[85%] items-center justify-between z-0">
                  {[0, 1, 2, 3, 4].map((step) => (
                    <motion.img
                      key={step}
                      src={birdFootprints}
                      alt=""
                      className="w-10 h-10"
                      style={{
                        marginTop: step % 2 === 0 ? '-10px' : '10px',
                      }}
                      initial={{ opacity: 0, scale: 0, rotate: 90 }}
                      whileInView={{ opacity: 0.6, scale: 1, rotate: 90 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.25, delay: 0.8 + step * 0.25 }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyMontessoriSection;
