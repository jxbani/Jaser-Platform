'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { ChallengeStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { ExplorerOption } from '@/lib/data/explorer';

interface Props {
  universities: ExplorerOption[];
  faculties: ExplorerOption[];
  tags: ExplorerOption[];
  initial: {
    q?: string;
    universityId?: string;
    facultyId?: string;
    tagId?: string;
    status?: ChallengeStatus;
  };
  labels: {
    university: string;
    faculty: string;
    tag: string;
    status: string;
    query: string;
    apply: string;
    reset: string;
    all: string;
    filters: string;
  };
}

const ALL = '__all__';

export function ExplorerFilters({
  universities,
  faculties,
  tags,
  initial,
  labels
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const commit = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== ALL) next.set(key, value);
    else next.delete(key);
    if (key !== 'q') next.delete('cursor');
    start(() => router.push(`/explorer?${next.toString()}`));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const next = new URLSearchParams();
    for (const [k, v] of formData.entries()) {
      const s = String(v);
      if (s && s !== ALL) next.set(k, s);
    }
    start(() => router.push(`/explorer?${next.toString()}`));
  };

  const reset = () => start(() => router.push('/explorer'));

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2 lg:grid-cols-5"
    >
      <div className="lg:col-span-2">
        <Label htmlFor="q">{labels.query}</Label>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="q"
            name="q"
            defaultValue={initial.q ?? ''}
            placeholder={labels.query}
            className="ps-9"
          />
        </div>
      </div>

      <FilterSelect
        name="universityId"
        label={labels.university}
        all={labels.all}
        value={initial.universityId}
        options={universities}
        onChange={(v) => commit('universityId', v)}
      />

      <FilterSelect
        name="facultyId"
        label={labels.faculty}
        all={labels.all}
        value={initial.facultyId}
        options={faculties}
        onChange={(v) => commit('facultyId', v)}
      />

      <FilterSelect
        name="tagId"
        label={labels.tag}
        all={labels.all}
        value={initial.tagId}
        options={tags}
        onChange={(v) => commit('tagId', v)}
      />

      <div className="lg:col-span-2">
        <Label>{labels.status}</Label>
        <Select
          name="status"
          defaultValue={initial.status ?? ALL}
          onValueChange={(v) => commit('status', v)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={labels.all} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{labels.all}</SelectItem>
            {Object.values(ChallengeStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end gap-2 lg:col-span-3">
        <Button type="submit" disabled={pending} className="gap-2">
          <Filter className="h-4 w-4" />
          {labels.apply}
        </Button>
        <Button type="button" variant="outline" onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          {labels.reset}
        </Button>
      </div>
    </form>
  );
}

function FilterSelect({
  name,
  label,
  all,
  value,
  options,
  onChange
}: {
  name: string;
  label: string;
  all: string;
  value?: string;
  options: ExplorerOption[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select
        name={name}
        defaultValue={value ?? ALL}
        onValueChange={(v) => onChange(v)}
      >
        <SelectTrigger className="mt-1">
          <SelectValue placeholder={all} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{all}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
