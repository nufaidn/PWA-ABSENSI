"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Department filter.
 *
 * Implemented as its own client component rather than inside the shared filter
 * bar so the server page can place it at a different grid position.
 */
export function DepartmentSelect({
  basePath,
  departments,
}: {
  basePath: string;
  departments: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = searchParams.get("department") ?? "ALL";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="filter-department" className="text-[12px] font-medium">
        Departemen
      </label>
      <Select
        value={value}
        onValueChange={(next: string | null) => {
          const selected = next ?? "ALL";
          const params = new URLSearchParams(searchParams.toString());
          if (selected === "ALL") params.delete("department");
          else params.set("department", selected);
          params.delete("page");
          const query = params.toString();
          router.push(query ? `${basePath}?${query}` : basePath, { scroll: false });
        }}
      >
        <SelectTrigger id="filter-department" className="min-h-10 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Semua departemen</SelectItem>
          {departments.map((department) => (
            <SelectItem key={department} value={department}>
              {department}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}