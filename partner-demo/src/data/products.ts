/** Unsplash — verified `images.unsplash.com/photo-*` IDs (apparel / fashion). */
const q = "ixlib=rb-4.0.3&auto=format&fit=crop&w=480&h=640&q=82";
const u = (id: string) => `https://images.unsplash.com/${id}?${q}`;

export type Product = { id: string; title: string; price: string; img: string; alt: string };

export const PRODUCTS: Product[] = [
  { id: "1", title: "Merino crewneck", price: "$128", img: u("photo-1434389677669-e08b4cac3105"), alt: "Knit sweaters on wooden hangers" },
  { id: "2", title: "Tailored wool coat", price: "$420", img: u("photo-1539533018447-63fcce2678e3"), alt: "Camel tailored coat" },
  { id: "3", title: "Relaxed linen shirt", price: "$98", img: u("photo-1602810318383-e386cc2a3ccf"), alt: "Light linen shirt" },
  { id: "4", title: "Selvedge denim", price: "$185", img: u("photo-1490367532201-b9bc1dc483f6"), alt: "Folded blue denim jeans" },
  { id: "5", title: "Cashmere scarf", price: "$72", img: u("photo-1520903920243-00d872a2d1c9"), alt: "Soft folded scarf" },
  { id: "6", title: "Leather crossbody", price: "$265", img: u("photo-1590874103328-eac38a683ce7"), alt: "Brown leather handbag" },
  { id: "7", title: "Organic cotton tee", price: "$48", img: u("photo-1521572163474-6864f9cf17ab"), alt: "Plain white cotton t-shirt" },
  { id: "8", title: "Quilted puffer jacket", price: "$310", img: u("photo-1594938298603-c8148c4dae35"), alt: "Black quilted winter jacket" },
  { id: "9", title: "Canvas sneakers", price: "$135", img: u("photo-1549298916-b41d501d3772"), alt: "White low-top sneakers" },
  { id: "10", title: "Ribbed turtleneck", price: "$112", img: u("photo-1576566588028-4147f3842f27"), alt: "Black ribbed turtleneck top" },
  { id: "11", title: "Leather moto jacket", price: "$345", img: u("photo-1551028719-00167b16eac5"), alt: "Black leather jacket" },
  { id: "12", title: "Silk midi dress", price: "$198", img: u("photo-1515886657613-9f3515b0c78f"), alt: "Yellow silk fashion dress" },
  { id: "13", title: "Capsule wardrobe edit", price: "$92", img: u("photo-1583743814966-8936f5b7be1a"), alt: "Shirts hanging in a closet" },
  { id: "14", title: "Oxford shirt", price: "$88", img: u("photo-1603252109303-2751441dd157"), alt: "Folded denim and oxford shirts" },
  { id: "15", title: "Performance trainers", price: "$165", img: u("photo-1542291026-7eec264c27ff"), alt: "Red athletic running shoes" },
  { id: "16", title: "Fleece zip hoodie", price: "$95", img: u("photo-1556821840-3a63f95609a7"), alt: "Gray zip-up hoodie" },
  { id: "17", title: "Evening slip dress", price: "$210", img: u("photo-1595777457583-95e059d581b8"), alt: "Minimal black slip dress" },
  { id: "18", title: "Editorial wool wrap", price: "$385", img: u("photo-1552374196-c4e7ffc6e126"), alt: "Fashion model in structured outerwear" },
  { id: "19", title: "Chino trousers", price: "$118", img: u("photo-1473966968600-fa801b869a1a"), alt: "Tan chino pants flat lay" },
  { id: "20", title: "Runway trench", price: "$428", img: u("photo-1469334031218-e382a71b716b"), alt: "Model walking in long trench coat" },
  { id: "21", title: "Linen resort shirt", price: "$76", img: u("photo-1554568218-0f1715e72254"), alt: "Neutral linen shirt on hanger" }
];
