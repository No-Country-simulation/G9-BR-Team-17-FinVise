export function Footer() {
  return (
    <footer className="hidden border-t border-slate-200 bg-white py-4 lg:block">
      <div className="px-4 text-center text-xs text-slate-500 lg:px-8">
        © {new Date().getFullYear()} FinVise. Todos os direitos reservados.
      </div>
    </footer>
  );
}
