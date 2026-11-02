export interface Product {
  id: number
  name: string
  category: 'Audio' | 'Desk' | 'Bags' | 'Light'
  price: number
  rating: number
}

export const products: Product[] = [
  { id: 1, name: 'Studio Headphones', category: 'Audio', price: 899, rating: 4.7 },
  { id: 2, name: 'Pocket Speaker', category: 'Audio', price: 299, rating: 4.2 },
  { id: 3, name: 'Walnut Monitor Stand', category: 'Desk', price: 459, rating: 4.8 },
  { id: 4, name: 'Felt Desk Mat', category: 'Desk', price: 129, rating: 4.5 },
  { id: 5, name: 'Commuter Backpack', category: 'Bags', price: 699, rating: 4.6 },
  { id: 6, name: 'Sling Bag', category: 'Bags', price: 249, rating: 4.1 },
  { id: 7, name: 'Arc Desk Lamp', category: 'Light', price: 399, rating: 4.4 },
  { id: 8, name: 'Clip Reading Light', category: 'Light', price: 89, rating: 3.9 },
]
