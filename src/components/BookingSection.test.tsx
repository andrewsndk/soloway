import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookingSection from "./BookingSection";

vi.mock("framer-motion", () => ({ motion: { div: "div" } }));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("production booking form", () => {
  it.each([
    [new Date(2026, 8, 10, 12), "вересень 2026"],
    [new Date(2027, 0, 2, 12), "січень 2027"],
  ])("opens the current month on %s", (today, caption) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(today);
    render(<BookingSection />);
    expect(screen.getByRole("grid", { name: caption })).toBeInTheDocument();
  });

  it("offers half-day and every subscription alongside ordinary visits", () => {
    render(<BookingSection />);
    const select = screen.getByLabelText(/Формат відвідування/) as HTMLSelectElement;
    expect(Array.from(select.options, (option) => option.value)).toEqual([
      "Адаптація", "На 1 годину", "На 3 години", "Півдоби", "Цілий день",
      "Абонемент: 1 година", "Абонемент: 3 години", "Абонемент: Півдоби",
      "Абонемент: Цілий день", "Абонемент: Безліміт на місяць",
    ]);
    expect(screen.getByRole("option", { name: /Півдоби, 6 годин/ })).toBeInTheDocument();
  });

  it.each(["Півдоби", "Абонемент: Півдоби", "Абонемент: Безліміт на місяць"])(
    "submits the selected %s format to the configured backend", async (program) => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://booking-test.invalid");
      vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-key");
      const request = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", request);
      render(<BookingSection />);
      fireEvent.change(screen.getByLabelText(/Ваше ім'я/), { target: { value: "Тест" } });
      fireEvent.change(screen.getByLabelText(/Ваше прізвище/), { target: { value: "Перевірка" } });
      fireEvent.change(screen.getByLabelText(/Ім'я дитини/), { target: { value: "Демо" } });
      fireEvent.change(screen.getByLabelText(/Номер телефону/), { target: { value: "0501234567" } });
      fireEvent.change(screen.getByLabelText(/Формат відвідування/), { target: { value: program } });
      fireEvent.click(screen.getByRole("button", { name: /Забронювати візит/ }));
      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
      expect(request.mock.calls[0][0]).toBe("https://booking-test.invalid/functions/v1/send-visit");
      expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({
        program, phone: "+380501234567", childName: "Демо",
      });
    },
  );
});
