import { homeHTML } from '@/web/heritage';
import { incomeLimit } from './families/limits';
import { HomeEnhance } from './components/HomeEnhance';

export default async function Home({ searchParams }: { searchParams: Promise<{ notified?: string }> }) {
  const sp = await searchParams;
  const limits = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => Math.round(incomeLimit(n)));
  return (<><div dangerouslySetInnerHTML={{ __html: homeHTML(limits, !!sp.notified) }} /><HomeEnhance /></>);
}
