import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { github, parsePrUrl, summarizeChecks, useHasGithub } from './github';

export function usePr(prUrl?: string) {
  const ref = parsePrUrl(prUrl);
  const enabled = useHasGithub() && !!ref;
  const pr = useQuery({
    queryKey: ['gh-pr', prUrl],
    queryFn: () => github.pr(ref!),
    enabled,
    staleTime: 30_000,
  });
  const sha = pr.data?.head.sha;
  const checks = useQuery({
    queryKey: ['gh-checks', prUrl, sha],
    queryFn: () => github.checks(ref!, sha!).then((runs) => ({ runs, summary: summarizeChecks(runs) })),
    enabled: enabled && !!sha,
    staleTime: 20_000,
    refetchInterval: (q) => (q.state.data?.summary.running ? 15_000 : false),
  });
  return { ref, pr, checks, enabled };
}

export function usePrDetails(prUrl?: string) {
  const { ref, pr, checks, enabled } = usePr(prUrl);
  const sha = pr.data?.head.sha;
  const files = useQuery({
    queryKey: ['gh-files', prUrl, sha],
    queryFn: () => github.files(ref!),
    enabled: enabled && !!sha,
  });
  const reviews = useQuery({
    queryKey: ['gh-reviews', prUrl],
    queryFn: () => github.reviews(ref!),
    enabled,
  });
  const deployments = useQuery({
    queryKey: ['gh-deployments', prUrl, sha],
    queryFn: () => github.deployments(ref!, sha!),
    enabled: enabled && !!sha,
  });
  return { ref, pr, checks, files, reviews, deployments, enabled };
}

export function useMergePr(prUrl?: string) {
  const qc = useQueryClient();
  const ref = parsePrUrl(prUrl);
  return useMutation({
    mutationFn: (sha: string) => github.merge(ref!, sha, 'squash'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['gh-pr', prUrl] });
    },
  });
}
