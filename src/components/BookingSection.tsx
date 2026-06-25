import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Clock, Phone, User, Send } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"
];

const minBookingDate = new Date(2026, 6, 1);

const getDefaultBookingDate = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today >= minBookingDate ? today : minBookingDate;
};

interface TimeWheelPickerProps {
  slots: string[];
  selected: string;
  onChange: (value: string) => void;
}

const TimeWheelPicker = ({ slots, selected, onChange }: TimeWheelPickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 44; // px
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const idx = slots.indexOf(selected);
    if (idx !== -1 && containerRef.current) {
      containerRef.current.scrollTop = idx * itemHeight;
      setActiveIdx(idx);
    }
  }, [selected, slots]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const idx = Math.round(scrollTop / itemHeight);
    if (idx >= 0 && idx < slots.length) {
      setActiveIdx(idx);
      if (slots[idx] !== selected) {
        onChange(slots[idx]);
      }
    }
  };

  return (
    <div className="relative w-full max-w-[200px] mx-auto h-[180px] bg-stone-50/50 rounded-2xl border border-secondary/20 overflow-hidden flex items-center justify-center shadow-inner">
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Highlight/Lens Overlay */}
      <div className="absolute left-0 right-0 h-[44px] pointer-events-none border-y border-secondary/20 bg-secondary/10 z-10 top-1/2 -translate-y-1/2" />

      {/* Wheel Scroll Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth py-[68px] no-scrollbar"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {slots.map((slot, idx) => {
          const distance = Math.abs(idx - activeIdx);
          const scale = Math.max(0.8, 1 - distance * 0.1);
          const opacity = Math.max(0.4, 1 - distance * 0.3);

          return (
            <div
              key={slot}
              onClick={() => {
                if (containerRef.current) {
                  containerRef.current.scrollTop = idx * itemHeight;
                }
              }}
              className="h-[44px] flex items-center justify-center cursor-pointer snap-center select-none transition-all duration-200 ease-out"
              style={{
                transform: `scale(${scale})`,
                opacity: opacity,
              }}
            >
              <span className={`text-lg md:text-xl font-extrabold ${idx === activeIdx ? 'text-primary' : 'text-foreground/75'}`}>
                {slot}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BookingSection = () => {
  const [date, setDate] = useState<Date | undefined>(getDefaultBookingDate);
  const [selectedTime, setSelectedTime] = useState<string>(timeSlots[0]);
  const [selectedProgram, setSelectedProgram] = useState<string>("Цілий день");
  const [customHours, setCustomHours] = useState("");
  const [name, setName] = useState("");
  const [childName, setChildName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !selectedTime || !name || !childName || !phone || (selectedProgram === "Своя кількість годин" && !customHours)) {
      toast.error("Будь ласка, заповніть усі поля");
      return;
    }

    if (date < minBookingDate) {
      toast.error("Бронювання доступне з 1 липня 2026 року");
      return;
    }

    setIsSubmitting(true);

    const visitDate = format(date, "PPP", { locale: uk });

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl) {
        throw new Error("Supabase URL is not configured");
      }

      if (!supabaseAnonKey) {
        throw new Error("Supabase anon key is not configured");
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/send-visit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          name,
          childName,
          phone,
          visitDate,
          visitTime: selectedTime,
          program: selectedProgram === "Своя кількість годин" ? `Своя кількість годин (${customHours})` : selectedProgram
        }),
      });

      if (response.ok) {
        toast.success("Вашу заявку успішно надіслано! Ми зателефонуємо вам найближчим часом.");
        setName("");
        setChildName("");
        setPhone("");
        setCustomHours("");
        setSelectedTime(timeSlots[0]);
        setSelectedProgram("Цілий день");
      } else {
        throw new Error("Failed to send visit request");
      }
    } catch (error) {
      console.error("Visit request error:", error);
      toast.error("Помилка при відправці. Будь ласка, спробуйте ще раз або зателефонуйте нам.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-12 md:py-24 bg-white relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full -ml-48 -mb-48 blur-3xl" />

      <div className="container px-4 relative z-10">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8 md:mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-extrabold text-foreground mb-4 md:mb-6">
              Завітайте до нас у гості
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Оберіть зручний час для знайомства з нашим простором. Ми з радістю покажемо вам садочок та розповімо про наші методики.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-start bg-card rounded-[1.5rem] md:rounded-[3rem] p-4 sm:p-6 md:p-12 shadow-xl border border-secondary/20">
            {/* Left: Calendar */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-4 md:space-y-6"
            >
              <div className="flex items-center gap-3 text-xl font-bold text-foreground mb-4">
                <CalendarIcon className="text-primary w-6 h-6" />
                <span>Оберіть дату</span>
              </div>
              <div className="bg-white rounded-2xl p-2 sm:p-4 shadow-inner border border-stone-100 flex justify-center">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={{ before: minBookingDate }}
                  defaultMonth={minBookingDate}
                  fromDate={minBookingDate}
                  className="rounded-md"
                  locale={uk}
                />
              </div>
            </motion.div>

            {/* Right: Time & Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6 md:space-y-8"
            >
              <div>
                <div className="flex items-center gap-3 text-xl font-bold text-foreground mb-6">
                  <Clock className="text-secondary w-6 h-6" />
                  <span>Час, коли пташенятко до нас завітає</span>
                </div>
                <TimeWheelPicker
                  slots={timeSlots}
                  selected={selectedTime}
                  onChange={setSelectedTime}
                />
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="program" className="flex items-center gap-2 text-sm font-bold ml-2">
                      <span className="text-primary font-bold">✨</span> Формат відвідування
                    </Label>
                    <select
                      id="program"
                      value={selectedProgram}
                      onChange={(e) => setSelectedProgram(e.target.value)}
                      className="w-full rounded-xl border-2 border-stone-100 h-12 focus:border-primary px-4 bg-white text-foreground font-medium outline-none cursor-pointer"
                    >
                      <option value="Цілий день">Цілий день (1390 грн)</option>
                      <option value="Адаптація">Адаптація (300 грн)</option>
                      <option value="На 3 години">На 3 години (850 грн)</option>
                      <option value="На 1 годину">На 1 годину (500 грн)</option>
                      <option value="Своя кількість годин">Своя кількість годин</option>
                    </select>
                  </div>
                  {selectedProgram === "Своя кількість годин" && (
                    <div className="space-y-2">
                      <Label htmlFor="customHours" className="flex items-center gap-2 text-sm font-bold ml-2">
                        <span className="text-secondary font-bold">⏰</span> Вкажіть кількість годин
                      </Label>
                      <Input
                        id="customHours"
                        type="number"
                        min="1"
                        max="24"
                        placeholder="Наприклад: 5"
                        value={customHours}
                        onChange={(e) => setCustomHours(e.target.value)}
                        className="rounded-xl border-2 border-stone-100 h-12 focus:border-secondary px-4"
                        required
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2 text-sm font-bold ml-2">
                      <User className="w-4 h-4 text-primary" /> Ваше ім'я
                    </Label>
                    <Input
                      id="name"
                      placeholder="Наприклад: Марія"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="rounded-xl border-2 border-stone-100 h-12 focus:border-primary px-4"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="childName" className="flex items-center gap-2 text-sm font-bold ml-2">
                      <User className="w-4 h-4 text-secondary" /> Ім'я дитини
                    </Label>
                    <Input
                      id="childName"
                      placeholder="Наприклад: Олександр"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      className="rounded-xl border-2 border-stone-100 h-12 focus:border-secondary px-4"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-bold ml-2">
                      <Phone className="w-4 h-4 text-primary" /> Номер телефону
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+380 99 000 00 00"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="rounded-xl border-2 border-stone-100 h-12 focus:border-primary px-4"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-14 md:h-16 rounded-2xl text-base md:text-lg font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Надсилаємо...
                    </span>
                  ) : (
                    <>
                      <span>Забронювати візит</span>
                      <Send className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BookingSection;
