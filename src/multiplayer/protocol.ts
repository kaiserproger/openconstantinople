import {
  ALLIANCE_SILVER_AMOUNTS,
  type AllianceSilverAmount,
  type CampaignCommitment,
  type CampaignSiegeTactic,
  type CampaignState,
  type ProvinceProjectKind,
  type RealmId,
  isCampaignCommitment,
} from '../game/campaign'
import { FORMATION_SHAPES, type FormationShape } from '../game/tactics'

export type MatchPhase = 'lobby' | 'running' | 'finished'

export interface MatchPlayer {
  id: string
  name: string
  nationId: RealmId
  ready: boolean
}

export interface MatchEvent {
  revision: number
  kind:
    | 'march-started'
    | 'march-recalled'
    | 'march-resolved'
    | 'day-advanced'
    | 'province-mustered'
    | 'province-project-started'
    | 'province-project-completed'
    | 'province-formation'
    | 'diplomacy-changed'
    | 'alliance-offered'
    | 'alliance-accepted'
    | 'alliance-declined'
    | 'peace-offered'
    | 'peace-accepted'
    | 'peace-rejected'
    | 'alliance-silver-sent'
    | 'alliance-support-started'
    | 'trade-route-opened'
    | 'trade-route-closed'
    | 'trade-embargoed'
    | 'trade-resumed'
    | 'siege-started'
    | 'siege-tactic'
    | 'siege-retreated'
    | 'siege-sortie'
    | 'siege-advanced'
    | 'siege-resolved'
    | 'siege-lifted'
    | 'realm-defeated'
    | 'match-finished'
    | 'player-ready'
    | 'match-started'
  message: string
  provinceId: number | null
}

export type MatchCommand =
  | {
      type: 'lobby.ready'
      ready: boolean
    }
  | {
      type: 'campaign.attack'
      sourceId: number
      targetId: number
      commitment: CampaignCommitment
      formation: FormationShape
    }
  | {
      type: 'campaign.recall'
      marchId: string
    }
  | {
      type: 'campaign.support'
      sourceId: number
      targetId: number
      commitment: CampaignCommitment
      formation: FormationShape
    }
  | {
      type: 'campaign.transfer'
      targetNationId: RealmId
      amount: AllianceSilverAmount
    }
  | {
      type: 'campaign.trade-route'
      sourceId: number
      targetId: number
    }
  | {
      type: 'campaign.trade-policy'
      targetNationId: RealmId
      embargoed: boolean
    }
  | {
      type: 'campaign.siege-tactic'
      siegeId: string
      tactic: CampaignSiegeTactic
    }
  | {
      type: 'campaign.siege-retreat'
      siegeId: string
    }
  | {
      type: 'campaign.siege-sortie'
      siegeId: string
    }
  | {
      type: 'campaign.siege-march'
      siegeId: string
      sourceId: number
      commitment: CampaignCommitment
      formation: FormationShape
    }
  | {
      type: 'campaign.diplomacy'
      targetNationId: RealmId
      action:
        | 'gift'
        | 'alliance-offer'
        | 'alliance-accept'
        | 'alliance-decline'
        | 'war'
        | 'truce'
        | 'peace-demand'
        | 'peace-accept'
        | 'peace-reject'
        | 'peace-withdraw'
        | 'break-alliance'
      provinceId?: number
    }
  | {
      type: 'campaign.muster'
      provinceId: number
    }
  | {
      type: 'campaign.develop'
      provinceId: number
      project: ProvinceProjectKind
    }
  | {
      type: 'campaign.defense'
      provinceId: number
      formation: FormationShape
    }

export type ClientMessage =
  | {
      type: 'join'
      roomId: string
      playerName: string
      nationId: RealmId
    }
  | {
      type: 'command'
      commandId: string
      revision: number
      command: MatchCommand
    }

export type ServerMessage =
  | {
      type: 'snapshot'
      roomId: string
      revision: number
      phase: MatchPhase
      serverNow: number
      self: {
        playerId: string
        silver: number
        legitimacy: number
      }
      campaign: CampaignState
      players: MatchPlayer[]
      events: MatchEvent[]
    }
  | {
      type: 'rejected'
      commandId: string | null
      reason: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null
  if (value.type === 'join') {
    if (
      typeof value.roomId !== 'string'
      || !/^[a-z0-9-]{3,24}$/i.test(value.roomId)
      || typeof value.playerName !== 'string'
      || value.playerName.trim().length < 2
      || value.playerName.trim().length > 24
      || typeof value.nationId !== 'string'
    ) return null
    return {
      type: 'join',
      roomId: value.roomId.toLowerCase(),
      playerName: value.playerName.trim(),
      nationId: value.nationId,
    }
  }
  if (value.type !== 'command' || !isRecord(value.command)) return null
  const commandType = value.command.type
  if (
    typeof value.commandId !== 'string'
    || value.commandId.length > 64
    || !Number.isInteger(value.revision)
  ) return null
  if (commandType === 'lobby.ready') {
    if (typeof value.command.ready !== 'boolean') return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: 'lobby.ready',
        ready: value.command.ready,
      },
    }
  }
  if (commandType === 'campaign.diplomacy') {
    if (
      typeof value.command.targetNationId !== 'string'
      || ![
        'gift',
        'alliance-offer',
        'alliance-accept',
        'alliance-decline',
        'war',
        'truce',
        'peace-demand',
        'peace-accept',
        'peace-reject',
        'peace-withdraw',
        'break-alliance',
      ].includes(String(value.command.action))
      || (value.command.action === 'peace-demand' && !Number.isInteger(value.command.provinceId))
    ) return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: 'campaign.diplomacy',
        targetNationId: value.command.targetNationId,
        action: value.command.action as Extract<MatchCommand, { type: 'campaign.diplomacy' }>['action'],
        provinceId: Number.isInteger(value.command.provinceId) ? value.command.provinceId as number : undefined,
      },
    }
  }
  if (commandType === 'campaign.muster') {
    if (!Number.isInteger(value.command.provinceId)) return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: commandType,
        provinceId: value.command.provinceId as number,
      },
    }
  }
  if (commandType === 'campaign.develop') {
    if (
      !Number.isInteger(value.command.provinceId)
      || !['settlement', 'market', 'fortification', 'workshop'].includes(String(value.command.project))
    ) return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: commandType,
        provinceId: value.command.provinceId as number,
        project: value.command.project as ProvinceProjectKind,
      },
    }
  }
  if (commandType === 'campaign.defense') {
    if (
      !Number.isInteger(value.command.provinceId)
      || !FORMATION_SHAPES.includes(value.command.formation as FormationShape)
    ) return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: commandType,
        provinceId: value.command.provinceId as number,
        formation: value.command.formation as FormationShape,
      },
    }
  }
  if (commandType === 'campaign.recall') {
    if (
      typeof value.command.marchId !== 'string'
      || value.command.marchId.length < 1
      || value.command.marchId.length > 64
    ) return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: commandType,
        marchId: value.command.marchId,
      },
    }
  }
  if (commandType === 'campaign.transfer') {
    if (
      typeof value.command.targetNationId !== 'string'
      || !ALLIANCE_SILVER_AMOUNTS.includes(value.command.amount as AllianceSilverAmount)
    ) return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: commandType,
        targetNationId: value.command.targetNationId,
        amount: value.command.amount as AllianceSilverAmount,
      },
    }
  }
  if (commandType === 'campaign.support') {
    if (
      !Number.isInteger(value.command.sourceId)
      || !Number.isInteger(value.command.targetId)
      || !isCampaignCommitment(value.command.commitment)
      || !FORMATION_SHAPES.includes(value.command.formation as FormationShape)
    ) return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: commandType,
        sourceId: value.command.sourceId as number,
        targetId: value.command.targetId as number,
        commitment: value.command.commitment,
        formation: value.command.formation as FormationShape,
      },
    }
  }
  if (commandType === 'campaign.trade-route') {
    if (!Number.isInteger(value.command.sourceId) || !Number.isInteger(value.command.targetId)) return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: commandType,
        sourceId: value.command.sourceId as number,
        targetId: value.command.targetId as number,
      },
    }
  }
  if (commandType === 'campaign.trade-policy') {
    if (
      typeof value.command.targetNationId !== 'string'
      || typeof value.command.embargoed !== 'boolean'
    ) return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: commandType,
        targetNationId: value.command.targetNationId,
        embargoed: value.command.embargoed,
      },
    }
  }
  if (commandType === 'campaign.siege-tactic') {
    if (
      typeof value.command.siegeId !== 'string'
      || value.command.siegeId.length < 1
      || value.command.siegeId.length > 64
      || !['blockade', 'sappers', 'assault'].includes(String(value.command.tactic))
    ) return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: commandType,
        siegeId: value.command.siegeId,
        tactic: value.command.tactic as CampaignSiegeTactic,
      },
    }
  }
  if (commandType === 'campaign.siege-retreat' || commandType === 'campaign.siege-sortie') {
    if (
      typeof value.command.siegeId !== 'string'
      || value.command.siegeId.length < 1
      || value.command.siegeId.length > 64
    ) return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: commandType,
        siegeId: value.command.siegeId,
      },
    }
  }
  if (commandType === 'campaign.siege-march') {
    if (
      typeof value.command.siegeId !== 'string'
      || value.command.siegeId.length < 1
      || value.command.siegeId.length > 64
      || !Number.isInteger(value.command.sourceId)
      || !isCampaignCommitment(value.command.commitment)
      || !FORMATION_SHAPES.includes(value.command.formation as FormationShape)
    ) return null
    return {
      type: 'command',
      commandId: value.commandId,
      revision: value.revision as number,
      command: {
        type: commandType,
        siegeId: value.command.siegeId,
        sourceId: value.command.sourceId as number,
        commitment: value.command.commitment,
        formation: value.command.formation as FormationShape,
      },
    }
  }
  if (
    commandType !== 'campaign.attack'
    || !Number.isInteger(value.command.sourceId)
    || !Number.isInteger(value.command.targetId)
    || !isCampaignCommitment(value.command.commitment)
    || !FORMATION_SHAPES.includes(value.command.formation as FormationShape)
  ) return null
  return {
    type: 'command',
    commandId: value.commandId,
    revision: value.revision as number,
    command: {
      type: 'campaign.attack',
      sourceId: value.command.sourceId as number,
      targetId: value.command.targetId as number,
      commitment: value.command.commitment,
      formation: value.command.formation as FormationShape,
    },
  }
}

export function parseServerMessage(value: unknown): ServerMessage | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null
  if (value.type === 'rejected') {
    if (typeof value.reason !== 'string') return null
    return {
      type: 'rejected',
      commandId: typeof value.commandId === 'string' ? value.commandId : null,
      reason: value.reason,
    }
  }
  if (
    value.type !== 'snapshot'
    || typeof value.roomId !== 'string'
    || !Number.isInteger(value.revision)
    || !['lobby', 'running', 'finished'].includes(String(value.phase))
    || typeof value.serverNow !== 'number'
    || !isRecord(value.self)
    || typeof value.self.playerId !== 'string'
    || typeof value.self.silver !== 'number'
    || typeof value.self.legitimacy !== 'number'
    || !isRecord(value.campaign)
    || !Array.isArray(value.players)
    || !Array.isArray(value.events)
  ) return null
  return value as unknown as ServerMessage
}
