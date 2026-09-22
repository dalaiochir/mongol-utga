"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main style={{ padding: 40 }}>
      <h1>Хуудсыг ачаалахад алдаа гарлаа</h1>
      <p>Хадгалсан өгөгдлөө устгахгүйгээр дахин оролдоно уу.</p>
      <button onClick={reset}>Дахин оролдох</button>
    </main>
  );
}
