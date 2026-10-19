import { loginHint } from "@/lib/demo-account";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex flex-col justify-between bg-sidebar px-10 py-12 text-[#ebe6dc] lg:px-16">
        <p className="font-serif text-3xl text-white">ClosingDesk</p>
        <div className="max-w-md">
          <h1 className="font-serif text-5xl leading-tight text-white">Check the purchase agreement against the offer that was accepted.</h1>
          <p className="mt-6 text-lg leading-8 text-[#d9d2c6]">
            ClosingDesk lines up price, dates, deposits, and contingencies, and keeps your decision separate from the draft finding.
          </p>
        </div>
        <p className="text-sm text-[#b7b0a4]">Every finding needs attorney verification. This is not a legal determination.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <LoginForm hint={loginHint()} />
      </section>
    </div>
  );
}
