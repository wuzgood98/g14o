import { handleSearch } from "@/lib/search/server";

export const revalidate = false;

export const GET = handleSearch;
