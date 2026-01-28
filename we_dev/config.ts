import { defineConfig } from '@theweave/cli';

export default defineConfig({
  toolCurations: [
    {
      url: 'https://raw.githubusercontent.com/lightningrodlabs/weave-tool-curation/refs/heads/test-0.14/0.14/lists/curations-0.14.json',
      useLists: ['default'],
    },
  ],
  groups: [
    {
      name: 'FarmHack Dev',
      networkSeed: 'farmhack-dev-seed-001',
      icon: {
        type: 'filesystem',
        path: './we_dev/farmhack_icon.png',
      },
      creatingAgent: {
        agentIdx: 1,
        agentProfile: {
          nickname: 'Farmer1',
          avatar: {
            type: 'filesystem',
            path: './we_dev/farmer1.jpg',
          },
        },
      },
      joiningAgents: [
        {
          agentIdx: 2,
          agentProfile: {
            nickname: 'Farmer2',
            avatar: {
              type: 'filesystem',
              path: './we_dev/farmer2.jpg',
            },
          },
        },
      ],
      applets: [
        {
          name: 'FarmHack Hot Reload',
          instanceName: 'FarmHack Hot Reload',
          registeringAgent: 1,
          joiningAgents: [2],
        },
        {
          name: 'FarmHack',
          instanceName: 'FarmHack',
          registeringAgent: 1,
          joiningAgents: [2],
        },
      ],
    },
  ],
  applets: [
    {
      name: 'FarmHack Hot Reload',
      subtitle: 'FarmHack',
      description: 'Collaborative farm tool library',
      icon: {
        type: 'filesystem',
        path: './we_dev/farmhack_icon.png',
      },
      source: {
        type: 'localhost',
        happPath: './workdir/farmhack.happ',
        uiPort: 1420,
      },
    },
    {
      name: 'FarmHack',
      subtitle: 'FarmHack',
      description: 'Collaborative farm tool library',
      icon: {
        type: 'filesystem',
        path: './we_dev/farmhack_icon.png',
      },
      source: {
        type: 'filesystem',
        path: './workdir/farmhack.webhapp',
      },
    },
  ],
});
