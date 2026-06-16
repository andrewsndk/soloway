import { KidzyLogo } from "@/components/KidzyLogo";

const FooterSection = () => {
  return (
    <footer id="contact" className="bg-foreground text-background py-10 md:py-16">
      <div className="container px-4">
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          <div>
            <div className="mb-4">
              <KidzyLogo onDark className="h-24 md:h-32" />
            </div>
            <p className="text-background/70 text-sm leading-relaxed">
              Створюємо простір, де кожна дитина розкриває свій потенціал через радість відкриттів.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4">Контакти</h4>
            <p className="text-background/70 text-sm mb-1">+380 (67) 123-45-67</p>
            <p className="text-background/70 text-sm mb-1">info@kidzy.ua</p>
            <p className="text-background/70 text-sm">м. Київ, вул. Дитяча, 12</p>
          </div>
          <div>
            <h4 className="font-bold mb-4">Години роботи</h4>
            <p className="text-background/70 text-sm mb-1">Пн — Пт: 8:00 — 19:00</p>
            <p className="text-background/70 text-sm">Сб — Нд: вихідний</p>
          </div>
        </div>
        <div className="border-t border-background/20 mt-8 md:mt-12 pt-6 text-center text-background/50 text-xs">
          © 2026 KIDZY Монтессорі. Усі права захищені.
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
