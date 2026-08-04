export function Footer() {
  return (
    <footer className="hidden border-t border-white/10 bg-white/5 py-4 backdrop-blur-xl lg:block">
      <div className="px-4 text-center text-xs text-slate-300 lg:px-8">
        © {new Date().getFullYear()} FinVise. Todos os direitos reservados.
      </div>
    </footer>
  );
}
