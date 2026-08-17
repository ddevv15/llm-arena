import { HomeContent } from "@/components/home-content";
import { getModelCatalog } from "@/lib/model-catalog";

export default async function Home() {
  const catalog = await getModelCatalog();

  return <HomeContent catalog={catalog} />;
}
