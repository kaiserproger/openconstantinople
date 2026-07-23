import { createCampaign, type CampaignState } from '../../src/game/campaign'

export function createFinalCampaign(seed: string): CampaignState {
  const campaign = createCampaign(seed)
  const source = campaign.provinces.find((province) => province.column === 2 && province.row === 5)!
  const target = campaign.provinces.find((province) => province.column === 3 && province.row === 5)!

  for (const province of campaign.provinces) {
    province.owner = 'porphyry'
    province.capitalOf = null
  }
  source.capitalOf = 'porphyry'
  source.cityLevel = 2
  source.levies = 120
  target.owner = 'seljuk'
  target.capitalOf = 'seljuk'
  target.cityLevel = 2
  target.levies = 8
  target.defenseFormation = 'line'

  const bulgar = campaign.realms.find((realm) => realm.id === 'bulgar')!
  bulgar.status = 'defeated'
  bulgar.defeatedAt = 0
  bulgar.defeatedBy = 'porphyry'
  return campaign
}
