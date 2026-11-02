import { products } from './products'

export function App() {
  return (
    <main className="page">
      <h1>Demo Shop</h1>
      <ul className="grid">
        {products.map((p) => (
          <li key={p.id} className="card">
            <span className="category">{p.category}</span>
            <strong>{p.name}</strong>
            <span>¥{p.price}</span>
            <span className="rating">★ {p.rating}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
