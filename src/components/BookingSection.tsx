import { useState } from "react";
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
  "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"
];

const BookingSection = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !selectedTime || !name || !phone) {
      toast.error("Будь ласка, заповніть усі поля");
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
        body: JSON.stringify({ name, phone, visitDate, visitTime: selectedTime }),
      });

      if (response.ok) {
        toast.success("Вашу заявку успішно надіслано! Ми зателефонуємо вам найближчим часом.");
        setName("");
        setPhone("");
        setSelectedTime("");
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
                  onSelect={setDate}
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
                  <span>Оберіть час</span>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`py-2.5 md:py-3 px-2 rounded-xl text-sm font-bold transition-all border-2 ${
                        selectedTime === slot
                          ? "bg-secondary text-white border-secondary shadow-lg scale-105"
                          : "bg-white text-foreground border-stone-100 hover:border-secondary/30 hover:bg-secondary/5"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
                <div className="space-y-4">
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
