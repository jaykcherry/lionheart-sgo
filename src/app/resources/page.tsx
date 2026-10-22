import { ResourcesClient } from './ResourcesClient';
import { incomeLimit } from '../families/limits';

export const metadata = { title: 'Resources — Lionheart', description: 'Free flyers, social graphics, QR codes and copy for Tennessee private schools, community groups and supporters.' };

export default async function Resources({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const sp = await searchParams;
  return <ResourcesClient school={sp.school} limit4={Math.round(incomeLimit(4))} />;
}
