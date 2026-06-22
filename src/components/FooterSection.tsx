import { KidzyLogo } from "@/components/KidzyLogo";

const FooterSection = () => {
  return (
    <footer className="bg-stone-50 text-foreground border-t border-stone-200/80 py-10 md:py-16">
      <div className="container px-4">
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          <div>
            <div className="mb-4">
              <KidzyLogo className="h-24 md:h-32" />
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Створюємо простір, де кожна дитина розкриває свій потенціал через радість відкриттів.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-foreground">Контакти</h4>
            <p className="text-muted-foreground text-sm mb-2">
              <a href="mailto:solowaymontessoriroom@gmail.com" className="hover:text-primary transition-colors">
                solowaymontessoriroom@gmail.com
              </a>
            </p>
            <p className="text-muted-foreground text-sm mb-2">
              <a
                href="https://www.instagram.com/solo.way.montessori?igsh=MXAxbmYzM2ZwYjFpOA=="
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-primary transition-colors font-semibold"
              >
                📸 Instagram
              </a>
            </p>
            <p className="text-muted-foreground text-sm">
              <a
                href="https://maps.app.goo.gl/LAbsWk2bQnbeYpoS9"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                📍 м. Київ, вул. Причальна, 8
              </a>
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-foreground">Години роботи</h4>
            <p className="text-muted-foreground text-sm mb-1">Пн — Пт: 9:00 — 19:30</p>
            <p className="text-muted-foreground text-sm">Сб — Нд: вихідний</p>
          </div>
        </div>
        <div className="border-t border-stone-200 mt-8 md:mt-12 pt-6 text-center text-muted-foreground/60 text-xs">
          © 2026 SoloWay Монтессорі. Усі права захищені.
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
