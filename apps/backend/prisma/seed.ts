import { PrismaClient, SourceAccess } from '@prisma/client'
import { scoreListings, signalsToDisplayStrings } from '../src/lib/riskEngine.js'
import { syncGraphFromEntities } from '../src/lib/graphSync.js'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Nexus Intel database…')

  // ─── Sources ────────────────────────────────────────────────────────────────

  const hansaSource = await prisma.source.upsert({
    where: { name: 'Hansa Marketplace' },
    update: {},
    create: {
      id: "src_tvurjr3aw6eziqhrtf4pwxw4",
      name: 'Hansa Marketplace',
      type: 'dark_web_market',
      access: SourceAccess.PUBLIC,
    },
  })

  const valhallaSource = await prisma.source.upsert({
    where: { name: 'Valhalla Marketplace' },
    update: {},
    create: {
      id: "src_y6k8fxgwnht3emcv8mt3stb2",
      name: 'Valhalla Marketplace',
      type: 'dark_web_market',
      access: SourceAccess.PUBLIC,
    },
  })

  console.log('Sources created:', hansaSource.name, valhallaSource.name)

  // ─── Entities (vendors) ─────────────────────────────────────────────────────

  await prisma.entity.upsert({
    where: { displayId: "Hackyboy" },
    update: {},
    create: {
      id: "ent_1xrdh2up5txj6u7usgd8psmf",
      displayId: "Hackyboy",
      alias: "Hackyboy",
      risk: 71,
      confidence: 82,
      riskChange: 1,
      firstSeen: new Date("2025-09-10T07:24:00+00:00"),
      lastSeen:  new Date("2025-12-04T16:31:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "Netherlands", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "goldendrugs" },
    update: {},
    create: {
      id: "ent_8tobfmrwoq0xap29a8cm4yt8",
      displayId: "goldendrugs",
      alias: "goldendrugs",
      risk: 82,
      confidence: 95,
      riskChange: 4,
      firstSeen: new Date("2025-07-08T20:05:19+00:00"),
      lastSeen:  new Date("2025-08-24T20:04:42+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "ships_from", value: "Netherlands", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "HappyEyes" },
    update: {},
    create: {
      id: "ent_lvwg0jr1ws23e7ytwpsgoupu",
      displayId: "HappyEyes",
      alias: "HappyEyes",
      risk: 62,
      confidence: 64,
      riskChange: 3,
      firstSeen: new Date("2025-07-09T19:32:16+00:00"),
      lastSeen:  new Date("2025-11-19T22:06:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "United States", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "OnePiece" },
    update: {},
    create: {
      id: "ent_8gc0m2lwr3qoaocu2h09dmeh",
      displayId: "OnePiece",
      alias: "OnePiece",
      risk: 58,
      confidence: 66,
      riskChange: 13,
      firstSeen: new Date("2025-07-09T16:28:24+00:00"),
      lastSeen:  new Date("2025-11-16T17:43:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "Worldwide, Philippines", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "RepAAA" },
    update: {},
    create: {
      id: "ent_73ueeguxfcv4jp6qpoy1sc0q",
      displayId: "RepAAA",
      alias: "RepAAA",
      risk: 72,
      confidence: 88,
      riskChange: 10,
      firstSeen: new Date("2025-07-10T16:17:56+00:00"),
      lastSeen:  new Date("2025-11-30T10:13:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "Hong Kong, China", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "DUTCHBULK" },
    update: {},
    create: {
      id: "ent_2fazmtzljxq1u25vcqrzr1yi",
      displayId: "DUTCHBULK",
      alias: "DUTCHBULK",
      risk: 85,
      confidence: 72,
      riskChange: 9,
      firstSeen: new Date("2025-07-09T20:22:58+00:00"),
      lastSeen:  new Date("2025-08-15T20:22:58+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "ships_from", value: "Germany, Worldwide", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "Doug-Heffernan" },
    update: {},
    create: {
      id: "ent_12py06kaorl7rqj405mr97dk",
      displayId: "Doug-Heffernan",
      alias: "Doug-Heffernan",
      risk: 78,
      confidence: 89,
      riskChange: 14,
      firstSeen: new Date("2025-07-08T18:36:16+00:00"),
      lastSeen:  new Date("2025-08-06T18:33:49+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "ships_from", value: "Worldwide, Europe (EU)", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "montana193" },
    update: {},
    create: {
      id: "ent_71kf7ep57waaq4s375mblf7d",
      displayId: "montana193",
      alias: "montana193",
      risk: 67,
      confidence: 85,
      riskChange: 4,
      firstSeen: new Date("2025-09-13T04:01:00+00:00"),
      lastSeen:  new Date("2025-11-24T07:43:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "Lithuania", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "cerberus" },
    update: {},
    create: {
      id: "ent_bus6n2achj04ej8dqgy1m7al",
      displayId: "cerberus",
      alias: "cerberus",
      risk: 65,
      confidence: 75,
      riskChange: -3,
      firstSeen: new Date("2025-07-09T16:53:11+00:00"),
      lastSeen:  new Date("2025-11-12T13:20:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "Worldwide, United Kingdom", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "Junkiepig666" },
    update: {},
    create: {
      id: "ent_w3sep9t5l55xsksbmestqdtt",
      displayId: "Junkiepig666",
      alias: "Junkiepig666",
      risk: 55,
      confidence: 60,
      riskChange: -2,
      firstSeen: new Date("2025-07-09T19:28:34+00:00"),
      lastSeen:  new Date("2025-11-22T02:00:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "Germany, Worldwide", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "color" },
    update: {},
    create: {
      id: "ent_yn8bu5s2ddt33t27z30h68jj",
      displayId: "color",
      alias: "color",
      risk: 52,
      confidence: 83,
      riskChange: -3,
      firstSeen: new Date("2025-07-08T19:22:43+00:00"),
      lastSeen:  new Date("2025-11-20T17:56:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "Worldwide, United States", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "VideoK" },
    update: {},
    create: {
      id: "ent_9lfqdosd87p1z507ky8moeme",
      displayId: "VideoK",
      alias: "VideoK",
      risk: 30,
      confidence: 84,
      riskChange: 8,
      firstSeen: new Date("2025-07-09T19:28:34+00:00"),
      lastSeen:  new Date("2025-08-22T18:50:41+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "ships_from", value: "Worldwide", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "pckabml" },
    update: {},
    create: {
      id: "ent_ma1ufdr92pzoi0f6v4j590bf",
      displayId: "pckabml",
      alias: "pckabml",
      risk: 48,
      confidence: 94,
      riskChange: 11,
      firstSeen: new Date("2025-07-08T18:19:59+00:00"),
      lastSeen:  new Date("2025-11-21T22:24:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "Worldwide, United Kingdom", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "bank" },
    update: {},
    create: {
      id: "ent_ml7jsi729sgkdoempe1rlndp",
      displayId: "bank",
      alias: "bank",
      risk: 69,
      confidence: 77,
      riskChange: 15,
      firstSeen: new Date("2025-09-09T20:16:00+00:00"),
      lastSeen:  new Date("2025-12-03T11:37:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "United States", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "darkmarket03" },
    update: {},
    create: {
      id: "ent_qbeyx2pkfz2fxykozj2jm662",
      displayId: "darkmarket03",
      alias: "darkmarket03",
      risk: 73,
      confidence: 71,
      riskChange: 0,
      firstSeen: new Date("2025-09-19T06:27:00+00:00"),
      lastSeen:  new Date("2025-11-16T09:25:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "United States", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "Meds2Buy" },
    update: {},
    create: {
      id: "ent_vbyuoq6dywhlc7top61iq9ef",
      displayId: "Meds2Buy",
      alias: "Meds2Buy",
      risk: 66,
      confidence: 72,
      riskChange: 7,
      firstSeen: new Date("2025-09-01T21:52:00+00:00"),
      lastSeen:  new Date("2025-11-12T04:16:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "Philippines", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "XTC-Love" },
    update: {},
    create: {
      id: "ent_xwq09pcv80spxikgn195o23c",
      displayId: "XTC-Love",
      alias: "XTC-Love",
      risk: 83,
      confidence: 55,
      riskChange: 6,
      firstSeen: new Date("2025-09-29T05:47:00+00:00"),
      lastSeen:  new Date("2025-12-07T14:39:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "Germany, Netherlands", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "ALaurizen" },
    update: {},
    create: {
      id: "ent_36ddjdz4xdpttlv94a1dagmc",
      displayId: "ALaurizen",
      alias: "ALaurizen",
      risk: 88,
      confidence: 70,
      riskChange: 13,
      firstSeen: new Date("2025-07-08T18:26:20+00:00"),
      lastSeen:  new Date("2025-08-14T19:50:43+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "ships_from", value: "Worldwide, China", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "cyberzen" },
    update: {},
    create: {
      id: "ent_bokp25p4fkb8kcfm9yuoprwj",
      displayId: "cyberzen",
      alias: "cyberzen",
      risk: 42,
      confidence: 90,
      riskChange: 14,
      firstSeen: new Date("2025-09-08T08:11:00+00:00"),
      lastSeen:  new Date("2025-11-20T16:25:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "Finland", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "ROCKETCHEM" },
    update: {},
    create: {
      id: "ent_a1w51f0z77drqncgh9uynm25",
      displayId: "ROCKETCHEM",
      alias: "ROCKETCHEM",
      risk: 91,
      confidence: 85,
      riskChange: 10,
      firstSeen: new Date("2025-07-09T19:49:58+00:00"),
      lastSeen:  new Date("2025-08-19T19:49:58+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "ships_from", value: "China", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "smart666tiger" },
    update: {},
    create: {
      id: "ent_la8ayv6enoikwiux01fcg1tc",
      displayId: "smart666tiger",
      alias: "smart666tiger",
      risk: 80,
      confidence: 73,
      riskChange: -3,
      firstSeen: new Date("2025-07-08T18:38:40+00:00"),
      lastSeen:  new Date("2025-11-05T13:21:00+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "marketplace_alias", value: "Valhalla", confidence: 90 },
          { type: "ships_from", value: "Worldwide, Iceland", confidence: 70 },
        ],
      },
    },
  })

  await prisma.entity.upsert({
    where: { displayId: "dutchcandyshop" },
    update: {},
    create: {
      id: "ent_gexg6zp45elm29kd6ht74576",
      displayId: "dutchcandyshop",
      alias: "dutchcandyshop",
      risk: 79,
      confidence: 80,
      riskChange: 12,
      firstSeen: new Date("2025-07-11T15:58:15+00:00"),
      lastSeen:  new Date("2025-08-09T15:57:44+00:00"),
      identifiers: {
        create: [
          { type: "marketplace_alias", value: "Hansa", confidence: 90 },
          { type: "ships_from", value: "Europe (EU), Belgium", confidence: 70 },
        ],
      },
    },
  })

  console.log(`Entities created: ${22}`)

  // ─── Listings ───────────────────────────────────────────────────────────────

  await prisma.listing.upsert({
    where: { displayId: "H-37713" },
    update: {},
    create: {
      id: "lst_ihuim5zkfpb2xyo8lq0fvbdy",
      displayId: "H-37713",
      category: "Guides & Tutorials",
      risk: 40,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-08T18:19:59+00:00"),
      lastSeen:  new Date("2025-07-14T18:19:59+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "pckabml",
      title: "The Basics of Information Security 2nd edition 2014",
      priceUsd: 2.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-4834" },
    update: {},
    create: {
      id: "lst_wykcuzppba6r3suqx5vh44li",
      displayId: "H-4834",
      category: "Guides & Tutorials",
      risk: 27,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-09T18:11:49+00:00"),
      lastSeen:  new Date("2025-07-22T18:11:49+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "pckabml",
      title: "Pick-5-Book List: (ISC)2 Cert Guides",
      priceUsd: 13.0,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-47913" },
    update: {},
    create: {
      id: "lst_8tdrogm7tjgv1y5qcqhzovff",
      displayId: "H-47913",
      category: "Guides & Tutorials",
      risk: 41,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-13T16:38:21+00:00"),
      lastSeen:  new Date("2025-08-21T16:38:21+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "pckabml",
      title: "Computer Security Fundamentals 3rd edition 2016",
      priceUsd: 2.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-37493" },
    update: {},
    create: {
      id: "lst_71c2eckrfb866qdf8hy5ph0r",
      displayId: "H-37493",
      category: "Guides & Tutorials",
      risk: 38,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-11T16:52:48+00:00"),
      lastSeen:  new Date("2025-07-18T16:52:48+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "pckabml",
      title: "Social Media Security 2014",
      priceUsd: 2.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-3880" },
    update: {},
    create: {
      id: "lst_jabvbodtwvy4w3wti1h5tie3",
      displayId: "H-3880",
      category: "Services",
      risk: 32,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-09T18:27:26+00:00"),
      lastSeen:  new Date("2025-07-28T18:27:26+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "color",
      title: "Hacking Web Intelligence",
      priceUsd: 1.0,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-10466" },
    update: {},
    create: {
      id: "lst_v3ox7t3zezzlw07a4fjuhy9x",
      displayId: "H-10466",
      category: "Services",
      risk: 49,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-08T19:22:43+00:00"),
      lastSeen:  new Date("2025-08-17T19:22:43+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "color",
      title: "Hackproofing Oracle Application Server",
      priceUsd: 1.0,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-10113" },
    update: {},
    create: {
      id: "lst_ezqsoh6iobo0ctv3tdzqaarq",
      displayId: "H-10113",
      category: "Services",
      risk: 52,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-13T19:24:50+00:00"),
      lastSeen:  new Date("2025-08-21T19:24:50+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "color",
      title: "Hacking - The Art of Exploitation",
      priceUsd: 1.0,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-4344" },
    update: {},
    create: {
      id: "lst_s2v5dnc9cc13ca1c3o8jui0l",
      displayId: "H-4344",
      category: "Services",
      risk: 37,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-11T19:04:37+00:00"),
      lastSeen:  new Date("2025-08-22T19:04:37+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "color",
      title: "THE HACKING BIBLE",
      priceUsd: 1.0,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-47286" },
    update: {},
    create: {
      id: "lst_g5qyzp6intrsa12hnva5x1wf",
      displayId: "H-47286",
      category: "Counterfeits",
      risk: 51,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-07-13T16:27:33+00:00"),
      lastSeen:  new Date("2025-08-01T16:27:33+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "RepAAA",
      title: "Rolex Day-Date 40 Yellow Gold 228238 Black Dial [AAA+]",
      priceUsd: 379.0,
      shipsFrom: "Hong Kong",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-3289" },
    update: {},
    create: {
      id: "lst_eo3ast7m2ljnekgzshvexv2o",
      displayId: "H-3289",
      category: "Counterfeits",
      risk: 52,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-07-14T16:27:16+00:00"),
      lastSeen:  new Date("2025-08-02T16:27:16+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "RepAAA",
      title: "Rolex Daytona RG White Dial Ceramic Bezel [AAA+]",
      priceUsd: 349.0,
      shipsFrom: "Hong Kong",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-13394" },
    update: {},
    create: {
      id: "lst_lvfe5qxf0jxhbljoct1zq53r",
      displayId: "H-13394",
      category: "Counterfeits",
      risk: 62,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-07-10T16:17:56+00:00"),
      lastSeen:  new Date("2025-08-13T16:17:56+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "RepAAA",
      title: "Rolex Sea-Dweller Deepsea D-Blue 3135 [Ultimate AAA+]",
      priceUsd: 489.0,
      shipsFrom: "Hong Kong",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-47464" },
    update: {},
    create: {
      id: "lst_rd272m5txs1jlbatbs0er608",
      displayId: "H-47464",
      category: "Counterfeits",
      risk: 55,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-07-10T16:27:28+00:00"),
      lastSeen:  new Date("2025-08-06T16:27:28+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "RepAAA",
      title: "Rolex Day-Date 40 SS 228239 Roman Blue Dial [AAA+]",
      priceUsd: 369.0,
      shipsFrom: "Hong Kong",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-9274" },
    update: {},
    create: {
      id: "lst_8f54vfr7vmyl4gla2j4bwq67",
      displayId: "H-9274",
      category: "Fraud Related",
      risk: 83,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-07-13T17:58:25+00:00"),
      lastSeen:  new Date("2025-08-16T17:58:25+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "OnePiece",
      title: "Carding - Find local BINs in your area",
      priceUsd: 1.5,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-4510" },
    update: {},
    create: {
      id: "lst_a45viqr2ey3hli4btkl0p3e4",
      displayId: "H-4510",
      category: "Guides & Tutorials",
      risk: 28,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-09T16:28:24+00:00"),
      lastSeen:  new Date("2025-07-29T16:28:24+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "OnePiece",
      title: "CCleaner Pro and Business Edition Serial Keys",
      priceUsd: 1.1,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-9283" },
    update: {},
    create: {
      id: "lst_avdahms0fvtd85u82voslr6w",
      displayId: "H-9283",
      category: "Fraud Related",
      risk: 72,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-07-10T19:34:29+00:00"),
      lastSeen:  new Date("2025-08-21T19:34:29+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "OnePiece",
      title: "Carding Vocabulary and understanding terms",
      priceUsd: 1.0,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-3642" },
    update: {},
    create: {
      id: "lst_83ljwprrt0vzay5pawdga339",
      displayId: "H-3642",
      category: "Guides & Tutorials",
      risk: 48,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-12T17:28:58+00:00"),
      lastSeen:  new Date("2025-08-11T17:28:58+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "OnePiece",
      title: "AntiForensics For Windows (buy 1 get 1 free)",
      priceUsd: 2.5,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-12709" },
    update: {},
    create: {
      id: "lst_ls6gpxja1xy41fld511flu50",
      displayId: "H-12709",
      category: "Fraud Related",
      risk: 55,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-07-13T19:31:57+00:00"),
      lastSeen:  new Date("2025-08-03T19:31:57+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "HappyEyes",
      title: "Paypal Verification",
      priceUsd: 2.0,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-12718" },
    update: {},
    create: {
      id: "lst_v3us71bn35tdw8vghg7dlqru",
      displayId: "H-12718",
      category: "Fraud Related",
      risk: 79,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-07-09T19:32:16+00:00"),
      lastSeen:  new Date("2025-08-15T19:32:16+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "HappyEyes",
      title: "WU Carding Tutorial (best one)",
      priceUsd: 3.0,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-12720" },
    update: {},
    create: {
      id: "lst_8n7ur59xpqqpq4wjw40w5rh5",
      displayId: "H-12720",
      category: "Counterfeits",
      risk: 77,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-07-13T16:04:50+00:00"),
      lastSeen:  new Date("2025-08-06T16:04:50+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "HappyEyes",
      title: "500 Million Ways to Make Money on Facebook",
      priceUsd: 1.0,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-9401" },
    update: {},
    create: {
      id: "lst_9qms3mj46b6yysgddo1mxran",
      displayId: "H-9401",
      category: "Fraud Related",
      risk: 74,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-07-09T19:32:24+00:00"),
      lastSeen:  new Date("2025-07-23T19:32:24+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "HappyEyes",
      title: "Microsoft Windows 7 ULTIMATE x86 x64 FULLY ACTIVATED",
      priceUsd: 3.0,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-12228" },
    update: {},
    create: {
      id: "lst_ol4b02i6j29xhmfygpe68r7i",
      displayId: "H-12228",
      category: "Electronics",
      risk: 20,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-12T15:34:46+00:00"),
      lastSeen:  new Date("2025-08-21T15:34:46+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "smart666tiger",
      title: "Get a FREE iPhone 6s !!!",
      priceUsd: 11.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-12687" },
    update: {},
    create: {
      id: "lst_pru8ash92g4mhlnymlnrq3ek",
      displayId: "H-12687",
      category: "Fraud Related",
      risk: 73,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-07-09T18:49:52+00:00"),
      lastSeen:  new Date("2025-07-14T18:49:52+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "smart666tiger",
      title: "1 CARDING AMAZON.COM 100% WORKING METHOD",
      priceUsd: 3.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-12548" },
    update: {},
    create: {
      id: "lst_8dj71p0l21nm2zwqna7u0tw1",
      displayId: "H-12548",
      category: "Fraud Related",
      risk: 77,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-07-13T19:15:31+00:00"),
      lastSeen:  new Date("2025-07-21T19:15:31+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "smart666tiger",
      title: "HIGH LEVEL USA FULLS (CC+CVV+SSN+DOB)",
      priceUsd: 70.0,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-12243" },
    update: {},
    create: {
      id: "lst_b8e069uatt75dpblmc46xzik",
      displayId: "H-12243",
      category: "Fraud Related",
      risk: 57,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-07-08T18:38:40+00:00"),
      lastSeen:  new Date("2025-08-03T18:38:40+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "smart666tiger",
      title: "USA Uber Accounts",
      priceUsd: 6.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-17210" },
    update: {},
    create: {
      id: "lst_fa5c0sslfidphbo5mcn4ezwj",
      displayId: "H-17210",
      category: "Drugs",
      risk: 92,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-09T16:53:23+00:00"),
      lastSeen:  new Date("2025-07-31T16:53:23+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "cerberus",
      title: "Cialis Pharma Grade Lilly brand 8 x 20mg tablets",
      priceUsd: 31.44,
      shipsFrom: "United Kingdom",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-46423" },
    update: {},
    create: {
      id: "lst_i2hygpzfjo7ojnbrhlnhr4my",
      displayId: "H-46423",
      category: "Counterfeits",
      risk: 56,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-07-12T16:02:05+00:00"),
      lastSeen:  new Date("2025-07-25T16:02:05+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "cerberus",
      title: "Canada Goose Black Mens Expedition size L/G",
      priceUsd: 113.18,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-53419" },
    update: {},
    create: {
      id: "lst_1b1j8eozgk0jt74q5a3gf3eb",
      displayId: "H-53419",
      category: "Counterfeits",
      risk: 68,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-07-11T16:10:59+00:00"),
      lastSeen:  new Date("2025-07-31T16:10:59+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "cerberus",
      title: "Ralph Lauren Navy Tracksuit XL",
      priceUsd: 31.44,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-45160" },
    update: {},
    create: {
      id: "lst_j8sv3m8s0iru2tlg4cevalwq",
      displayId: "H-45160",
      category: "Drugs",
      risk: 86,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-09T16:53:11+00:00"),
      lastSeen:  new Date("2025-07-20T16:53:11+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "cerberus",
      title: "Cerberus Pharma Dianabol 30mg x 10ml",
      priceUsd: 31.44,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-400" },
    update: {},
    create: {
      id: "lst_5g5p965v3rqktccyzvl0f4vw",
      displayId: "H-400",
      category: "Digital Goods",
      risk: 41,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-11T16:46:03+00:00"),
      lastSeen:  new Date("2025-08-07T16:46:03+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "Junkiepig666",
      title: "Necro - I Need Drugs",
      priceUsd: 2.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-436" },
    update: {},
    create: {
      id: "lst_tb9dt9bd4o6ip33g6ru73bdl",
      displayId: "H-436",
      category: "Digital Goods",
      risk: 33,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-11T17:32:29+00:00"),
      lastSeen:  new Date("2025-07-19T17:32:29+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "Junkiepig666",
      title: "PAYPAL - THE COMPLETE GUIDE TO RECEIVE AND CASHOUT!",
      priceUsd: 4.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-242" },
    update: {},
    create: {
      id: "lst_zk83jxdd1qriav4i93ur29dg",
      displayId: "H-242",
      category: "Digital Goods",
      risk: 21,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-11T19:47:33+00:00"),
      lastSeen:  new Date("2025-08-06T19:47:33+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "Junkiepig666",
      title: "Cheer Squad Sleepovers 13 - DVD",
      priceUsd: 4.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-54898" },
    update: {},
    create: {
      id: "lst_fvi853fcsacglzads78p3quv",
      displayId: "H-54898",
      category: "Digital Goods",
      risk: 27,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-09T19:28:34+00:00"),
      lastSeen:  new Date("2025-07-26T19:28:34+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "Junkiepig666",
      title: "Evil Anal 23 - DVD",
      priceUsd: 4.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-20189" },
    update: {},
    create: {
      id: "lst_ezzi7t0xgj502c9ra1oluwfv",
      displayId: "H-20189",
      category: "Drugs",
      risk: 60,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-14T17:30:51+00:00"),
      lastSeen:  new Date("2025-07-29T17:30:51+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "Doug-Heffernan",
      title: "\u260525x100ug LSD Anonymouse(Amber)",
      priceUsd: 100.34,
      shipsFrom: "Europe (EU)",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-51684" },
    update: {},
    create: {
      id: "lst_wtlk0robhtdoz28txqz6e7lv",
      displayId: "H-51684",
      category: "Drugs",
      risk: 81,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-10T17:37:24+00:00"),
      lastSeen:  new Date("2025-07-24T17:37:24+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "Doug-Heffernan",
      title: "\u260525x200UG\u2605Strawberry Blotter",
      priceUsd: 125.69,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-40541" },
    update: {},
    create: {
      id: "lst_4qz6sw9xlwwhzz2ub6nutlyy",
      displayId: "H-40541",
      category: "Drugs",
      risk: 81,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-08T18:36:16+00:00"),
      lastSeen:  new Date("2025-07-18T18:36:16+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "Doug-Heffernan",
      title: "\u26059Gr MDMA 84% Pure \u2605 Cola",
      priceUsd: 87.67,
      shipsFrom: "Europe (EU)",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-40473" },
    update: {},
    create: {
      id: "lst_iy50pjun1a0woumirq5fpm7v",
      displayId: "H-40473",
      category: "Drugs",
      risk: 66,
      signals: ["drug_sale", "bulk_quantity", "high_value_transaction"],
      firstSeen: new Date("2025-07-10T18:33:49+00:00"),
      lastSeen:  new Date("2025-08-06T18:33:49+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "Doug-Heffernan",
      title: "8 GR Pure Uncut Peruvian Coke",
      priceUsd: 565.09,
      shipsFrom: "Europe (EU)",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-55008" },
    update: {},
    create: {
      id: "lst_dkqx3l1iuf0q6zjwm8caijt7",
      displayId: "H-55008",
      category: "Drugs",
      risk: 76,
      signals: ["drug_sale", "bulk_quantity", "high_value_transaction"],
      firstSeen: new Date("2025-07-14T18:48:51+00:00"),
      lastSeen:  new Date("2025-07-21T18:48:51+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "goldendrugs",
      title: "20 gr super heroin from pakistan AAA+++",
      priceUsd: 792.18,
      shipsFrom: "Netherlands",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-55528" },
    update: {},
    create: {
      id: "lst_4yu84e89idwh5u8ykuao7yvz",
      displayId: "H-55528",
      category: "Drugs",
      risk: 94,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-08T20:05:19+00:00"),
      lastSeen:  new Date("2025-08-06T20:05:19+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "goldendrugs",
      title: "6 gr mdma dutch quality very good AAA+++ Champagne",
      priceUsd: 50.7,
      shipsFrom: "Netherlands",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-54179" },
    update: {},
    create: {
      id: "lst_7ddgyictu9vr8m933a35cnwe",
      displayId: "H-54179",
      category: "Drugs",
      risk: 95,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-10T20:04:42+00:00"),
      lastSeen:  new Date("2025-08-24T20:04:42+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "goldendrugs",
      title: "3 gr dry speed yellow very strong AAA+++",
      priceUsd: 28.52,
      shipsFrom: "Netherlands",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-54985" },
    update: {},
    create: {
      id: "lst_k7p9an8alrkr1jxbox1j98v3",
      displayId: "H-54985",
      category: "Drugs",
      risk: 83,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-12T19:39:37+00:00"),
      lastSeen:  new Date("2025-07-29T19:39:37+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "goldendrugs",
      title: "9 gr super heroin from pakistan AAA+++",
      priceUsd: 380.25,
      shipsFrom: "Netherlands",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-38234" },
    update: {},
    create: {
      id: "lst_elarwyaico6o1lgijqzldy34",
      displayId: "H-38234",
      category: "Digital Goods",
      risk: 41,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-10T18:50:58+00:00"),
      lastSeen:  new Date("2025-07-19T18:50:58+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "VideoK",
      title: "Premiumgfs.com [LIFETIME PORN PREMIUM ACCOUNT]",
      priceUsd: 4.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-37997" },
    update: {},
    create: {
      id: "lst_mg8qmnvildttbl88xry3blah",
      displayId: "H-37997",
      category: "Digital Goods",
      risk: 40,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-09T19:28:34+00:00"),
      lastSeen:  new Date("2025-08-17T19:28:34+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "VideoK",
      title: "Amaland.com [LIFETIME PORN PREMIUM ACCOUNT]",
      priceUsd: 4.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-54692" },
    update: {},
    create: {
      id: "lst_9qwb1fw98u477mibekwvwffk",
      displayId: "H-54692",
      category: "Erotica",
      risk: 20,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-11T18:54:12+00:00"),
      lastSeen:  new Date("2025-08-09T18:54:12+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "VideoK",
      title: "AsiaMoviePass.com [LIFETIME PORN PREMIUM ACCOUNT]",
      priceUsd: 4.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-38025" },
    update: {},
    create: {
      id: "lst_gvhfautb6zgcrckviyd53ovn",
      displayId: "H-38025",
      category: "Digital Goods",
      risk: 49,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-07-13T18:50:41+00:00"),
      lastSeen:  new Date("2025-08-22T18:50:41+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "VideoK",
      title: "FameDigital.com [LIFETIME PORN PREMIUM ACCOUNT]",
      priceUsd: 4.99,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-18365" },
    update: {},
    create: {
      id: "lst_scf578gfxw2r4j7t7pf6mpvz",
      displayId: "H-18365",
      category: "Drugs",
      risk: 80,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-14T20:13:54+00:00"),
      lastSeen:  new Date("2025-07-22T20:13:54+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "ALaurizen",
      title: "50gr. FUB-AKB",
      priceUsd: 340.0,
      shipsFrom: "China",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-18755" },
    update: {},
    create: {
      id: "lst_vkzrqzr09l120pzalsy1oci2",
      displayId: "H-18755",
      category: "Drugs",
      risk: 62,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-14T20:13:10+00:00"),
      lastSeen:  new Date("2025-08-08T20:13:10+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "ALaurizen",
      title: "5gr. 4-MPD (analog Mephedrone)",
      priceUsd: 90.0,
      shipsFrom: "China",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-49190" },
    update: {},
    create: {
      id: "lst_1m2gjg9do8x6l8810tki6qgu",
      displayId: "H-49190",
      category: "Drugs",
      risk: 77,
      signals: ["drug_sale", "bulk_quantity", "high_value_transaction"],
      firstSeen: new Date("2025-07-08T18:26:20+00:00"),
      lastSeen:  new Date("2025-07-26T18:26:20+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "ALaurizen",
      title: "20gr. Methadone",
      priceUsd: 700.0,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-29164" },
    update: {},
    create: {
      id: "lst_9a79okzgm7fsydbkap2ebu8i",
      displayId: "H-29164",
      category: "Drugs",
      risk: 80,
      signals: ["drug_sale", "bulk_quantity", "high_value_transaction"],
      firstSeen: new Date("2025-07-09T19:50:43+00:00"),
      lastSeen:  new Date("2025-08-14T19:50:43+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "ALaurizen",
      title: "1kg. Furanyl-Fentanyl (fentanyl analogue)",
      priceUsd: 9970.0,
      shipsFrom: "China",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-34019" },
    update: {},
    create: {
      id: "lst_ga7aopzx3i1zbw3gobdnlioa",
      displayId: "H-34019",
      category: "Drugs",
      risk: 74,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-09T20:22:58+00:00"),
      lastSeen:  new Date("2025-08-15T20:22:58+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "DUTCHBULK",
      title: "XTC - 100x - PURPLE - CHUPA CHUPS",
      priceUsd: 232.37,
      shipsFrom: "Germany",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-35467" },
    update: {},
    create: {
      id: "lst_3rl24fniszejyxsyeii3d673",
      displayId: "H-35467",
      category: "Drugs",
      risk: 65,
      signals: ["drug_sale", "bulk_quantity", "high_value_transaction"],
      firstSeen: new Date("2025-07-14T20:25:14+00:00"),
      lastSeen:  new Date("2025-07-22T20:25:14+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "DUTCHBULK",
      title: "LSD - 500x BLOTTERS - 150UG - GANESHA",
      priceUsd: 1478.74,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-34047" },
    update: {},
    create: {
      id: "lst_dsvp2hbwbt9ma0bpdw49s2oe",
      displayId: "H-34047",
      category: "Drugs",
      risk: 69,
      signals: ["drug_sale", "bulk_quantity", "high_value_transaction"],
      firstSeen: new Date("2025-07-13T20:22:06+00:00"),
      lastSeen:  new Date("2025-07-28T20:22:06+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "DUTCHBULK",
      title: "XTC - 1000x - WHITE - BITCOINS - 160MG",
      priceUsd: 1795.62,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-35472" },
    update: {},
    create: {
      id: "lst_ea3ehzklyzf1uh53wcujib27",
      displayId: "H-35472",
      category: "Drugs",
      risk: 64,
      signals: ["drug_sale", "bulk_quantity", "high_value_transaction"],
      firstSeen: new Date("2025-07-11T20:25:00+00:00"),
      lastSeen:  new Date("2025-08-09T20:25:00+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "DUTCHBULK",
      title: "LSD - 20000x BLOTTERS - 150UG - GANESHA",
      priceUsd: 44362.32,
      shipsFrom: "Worldwide",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-10025" },
    update: {},
    create: {
      id: "lst_35swvns2d7f4gvk13ep92l30",
      displayId: "H-10025",
      category: "Drugs",
      risk: 89,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-12T15:56:54+00:00"),
      lastSeen:  new Date("2025-08-02T15:56:54+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "dutchcandyshop",
      title: "TEST ORDER for COCAINE PURE UNCUT 90% AAA+ HQ",
      priceUsd: 31.69,
      shipsFrom: "Belgium",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-13074" },
    update: {},
    create: {
      id: "lst_zikst2ygbhzxgg9b6176gg0t",
      displayId: "H-13074",
      category: "Drugs",
      risk: 60,
      signals: ["drug_sale", "bulk_quantity", "high_value_transaction"],
      firstSeen: new Date("2025-07-13T15:57:59+00:00"),
      lastSeen:  new Date("2025-07-25T15:57:59+00:00"),
      status: "flagged",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "dutchcandyshop",
      title: "100G AMNESIA HAZE Cannabis + REST weed AAA+",
      priceUsd: 739.37,
      shipsFrom: "Europe (EU)",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-13057" },
    update: {},
    create: {
      id: "lst_y7o8hrg30gq700uvi72sdpcu",
      displayId: "H-13057",
      category: "Drugs",
      risk: 77,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-14T15:57:44+00:00"),
      lastSeen:  new Date("2025-08-09T15:57:44+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "dutchcandyshop",
      title: "250 XTC Pills 140mg (MDMA) 84% PURITY AAA+",
      priceUsd: 422.5,
      shipsFrom: "Belgium",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-26741" },
    update: {},
    create: {
      id: "lst_rwxngjcvcdgerotfupaph1j4",
      displayId: "H-26741",
      category: "Drugs",
      risk: 78,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-11T15:58:15+00:00"),
      lastSeen:  new Date("2025-07-26T15:58:15+00:00"),
      status: "removed",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "dutchcandyshop",
      title: "5 G - OUTDOOR Cannabis Weed",
      priceUsd: 52.81,
      shipsFrom: "Belgium",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-40334" },
    update: {},
    create: {
      id: "lst_ltj4yrwjq6hkt1vifk18ddwj",
      displayId: "H-40334",
      category: "Drugs",
      risk: 70,
      signals: ["drug_sale", "bulk_quantity", "high_value_transaction"],
      firstSeen: new Date("2025-07-12T19:42:09+00:00"),
      lastSeen:  new Date("2025-08-19T19:42:09+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "ROCKETCHEM",
      title: "Furanyl-Fentanyl 100g",
      priceUsd: 899.0,
      shipsFrom: "China",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-40873" },
    update: {},
    create: {
      id: "lst_5z7omigbkmck7wakoznl0zl0",
      displayId: "H-40873",
      category: "Drugs",
      risk: 80,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-11T19:10:56+00:00"),
      lastSeen:  new Date("2025-07-17T19:10:56+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "ROCKETCHEM",
      title: "Deschloroetizolam 10g",
      priceUsd: 450.0,
      shipsFrom: "China",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-41755" },
    update: {},
    create: {
      id: "lst_j368pgzojyues6cs5kpfnc6g",
      displayId: "H-41755",
      category: "Drugs",
      risk: 83,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-07-14T19:42:07+00:00"),
      lastSeen:  new Date("2025-08-07T19:42:07+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "ROCKETCHEM",
      title: "Furanyl-Fentanyl 20g",
      priceUsd: 290.0,
      shipsFrom: "China",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "H-41685" },
    update: {},
    create: {
      id: "lst_zepqu90ay1k6ddf6v0h077jr",
      displayId: "H-41685",
      category: "Drugs",
      risk: 63,
      signals: ["drug_sale", "bulk_quantity", "high_value_transaction"],
      firstSeen: new Date("2025-07-09T19:49:58+00:00"),
      lastSeen:  new Date("2025-08-19T19:49:58+00:00"),
      status: "active",
      sourceId: hansaSource.id,
      marketplace: "Hansa",
      vendorAlias: "ROCKETCHEM",
      title: "Fluor-Modafinil 1000g",
      priceUsd: 2300.0,
      shipsFrom: "China",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-10086" },
    update: {},
    create: {
      id: "lst_psvm9i5mtmc8bq55ndmjgli8",
      displayId: "V-10086",
      category: "Security & Hosting",
      risk: 61,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-16T10:15:00+00:00"),
      lastSeen:  new Date("2025-11-06T10:15:00+00:00"),
      status: "removed",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "Junkiepig666",
      title: "Hacking for Profit: Credit Card Fraud A Beginners Guide",
      priceUsd: 2.98,
      shipsFrom: "Germany",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-10087" },
    update: {},
    create: {
      id: "lst_64e34q11kecut3qmh4nbzsue",
      displayId: "V-10087",
      category: "Digital Goods",
      risk: 24,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-13T20:19:00+00:00"),
      lastSeen:  new Date("2025-11-16T20:19:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "Junkiepig666",
      title: "Introduction to Social Engineering",
      priceUsd: 2.98,
      shipsFrom: "Germany",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-10099" },
    update: {},
    create: {
      id: "lst_en23xg0fejc01o2pw55vwskd",
      displayId: "V-10099",
      category: "Security & Hosting",
      risk: 69,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-19T02:00:00+00:00"),
      lastSeen:  new Date("2025-11-22T02:00:00+00:00"),
      status: "flagged",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "Junkiepig666",
      title: "Learn The Basics of Ethical Hacking and Penetration Testing",
      priceUsd: 19.86,
      shipsFrom: "Germany",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-10100" },
    update: {},
    create: {
      id: "lst_zsvub9wvn1jqstrxpsnnyy94",
      displayId: "V-10100",
      category: "Digital Goods",
      risk: 38,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-07T02:34:00+00:00"),
      lastSeen:  new Date("2025-09-25T02:34:00+00:00"),
      status: "flagged",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "Junkiepig666",
      title: "How I Sell $7500 Month Online",
      priceUsd: 19.86,
      shipsFrom: "Germany",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-13962" },
    update: {},
    create: {
      id: "lst_igtxcfz3dr9cdlt4s2t9ikvx",
      displayId: "V-13962",
      category: "Counterfeits",
      risk: 73,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-10-06T04:17:00+00:00"),
      lastSeen:  new Date("2025-10-29T04:17:00+00:00"),
      status: "flagged",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "RepAAA",
      title: "Audemars Piguet - Box (AAA Grade Replica)",
      priceUsd: 124.22,
      shipsFrom: "China",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-13963" },
    update: {},
    create: {
      id: "lst_en7bq4lyqw0ocvlbdq15mv39",
      displayId: "V-13963",
      category: "Counterfeits",
      risk: 56,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-10-16T10:13:00+00:00"),
      lastSeen:  new Date("2025-11-30T10:13:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "RepAAA",
      title: "Audemars Piguet - Box 50% DISCOUNTED (AAA Grade Replica)",
      priceUsd: 74.52,
      shipsFrom: "China",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-13964" },
    update: {},
    create: {
      id: "lst_2hvwxr0iifcejy0wxa9v7wjm",
      displayId: "V-13964",
      category: "Counterfeits",
      risk: 66,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-10-02T08:57:00+00:00"),
      lastSeen:  new Date("2025-10-10T08:57:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "RepAAA",
      title: "Audemars Piguet - Royal Oak 15400 RG Black Dial [AAA+]",
      priceUsd: 441.21,
      shipsFrom: "China",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-13965" },
    update: {},
    create: {
      id: "lst_1z4ixdgb0t4ebbsu4yqfyytb",
      displayId: "V-13965",
      category: "Counterfeits",
      risk: 70,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-09-28T08:02:00+00:00"),
      lastSeen:  new Date("2025-10-03T08:02:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "RepAAA",
      title: "Audemars Piguet - Royal Oak 15400 SS Black Dial [AAA+]",
      priceUsd: 421.33,
      shipsFrom: "China",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-17661" },
    update: {},
    create: {
      id: "lst_bozond4mm3c3vllvbuizj0bs",
      displayId: "V-17661",
      category: "Security & Hosting",
      risk: 53,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-09T01:19:00+00:00"),
      lastSeen:  new Date("2025-10-07T01:19:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "color",
      title: "Hacking Wireless Networks For Dummies",
      priceUsd: 0.99,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-17768" },
    update: {},
    create: {
      id: "lst_3ascao36kwjk2rxher95vpee",
      displayId: "V-17768",
      category: "Security & Hosting",
      risk: 68,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-23T06:43:00+00:00"),
      lastSeen:  new Date("2025-10-13T06:43:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "color",
      title: "The Hacking Bible - The Dark secrets of the hacking world",
      priceUsd: 0.99,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-17770" },
    update: {},
    create: {
      id: "lst_43merp7z707l8trf9wrq8v4i",
      displayId: "V-17770",
      category: "Security & Hosting",
      risk: 51,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-20T17:56:00+00:00"),
      lastSeen:  new Date("2025-11-20T17:56:00+00:00"),
      status: "flagged",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "color",
      title: "The Hacker's Manual (2015)",
      priceUsd: 0.99,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-17771" },
    update: {},
    create: {
      id: "lst_5k5mvsvlox1rn2468hfdyyka",
      displayId: "V-17771",
      category: "Security & Hosting",
      risk: 63,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-10T07:55:00+00:00"),
      lastSeen:  new Date("2025-09-25T07:55:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "color",
      title: "The Basics of Web Hacking",
      priceUsd: 0.99,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18267" },
    update: {},
    create: {
      id: "lst_cipnkpqxticlo1x8r2utxi5m",
      displayId: "V-18267",
      category: "Digital Goods",
      risk: 48,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-27T00:11:00+00:00"),
      lastSeen:  new Date("2025-10-23T00:11:00+00:00"),
      status: "removed",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "HappyEyes",
      title: "7 reasons your credit card gets blocked",
      priceUsd: 0.99,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-21125" },
    update: {},
    create: {
      id: "lst_1fuofwn9ennbo2bkx4om3ung",
      displayId: "V-21125",
      category: "Guides & Tutorials",
      risk: 45,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-13T23:51:00+00:00"),
      lastSeen:  new Date("2025-11-02T23:51:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "HappyEyes",
      title: "Amazon Gift Card Tutorial [UK]",
      priceUsd: 0.99,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-21126" },
    update: {},
    create: {
      id: "lst_4qqtr6d45ylbewklvgwrc0e3",
      displayId: "V-21126",
      category: "Digital Goods",
      risk: 25,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-21T22:06:00+00:00"),
      lastSeen:  new Date("2025-11-19T22:06:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "HappyEyes",
      title: "Antifraud systems Explained",
      priceUsd: 0.99,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-21128" },
    update: {},
    create: {
      id: "lst_ck7gwlku8eup9qi6ve38bc15",
      displayId: "V-21128",
      category: "Fraud Related",
      risk: 82,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-10-01T07:12:00+00:00"),
      lastSeen:  new Date("2025-11-04T07:12:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "HappyEyes",
      title: "ATM Cash out CVV",
      priceUsd: 0.99,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18449" },
    update: {},
    create: {
      id: "lst_ct7tmhgxhttn4wzvvdxqjhu1",
      displayId: "V-18449",
      category: "Security & Hosting",
      risk: 41,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-07T19:27:00+00:00"),
      lastSeen:  new Date("2025-10-04T19:27:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "OnePiece",
      title: "Exploit Kit - Bleeding Life 2.0",
      priceUsd: 1.09,
      shipsFrom: "Philippines",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18450" },
    update: {},
    create: {
      id: "lst_8akrgcrwpn9ipx5y5fsko13d",
      displayId: "V-18450",
      category: "Digital Goods",
      risk: 33,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-09T16:07:00+00:00"),
      lastSeen:  new Date("2025-11-07T16:07:00+00:00"),
      status: "flagged",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "OnePiece",
      title: "Account Creator Extreme 4.2",
      priceUsd: 1.09,
      shipsFrom: "Philippines",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18451" },
    update: {},
    create: {
      id: "lst_89q0owepozn189pljfm8sq60",
      displayId: "V-18451",
      category: "Security & Hosting",
      risk: 46,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-17T01:45:00+00:00"),
      lastSeen:  new Date("2025-10-19T01:45:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "OnePiece",
      title: "Alien Spy RAT 5.0 with plugin",
      priceUsd: 1.09,
      shipsFrom: "Philippines",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18452" },
    update: {},
    create: {
      id: "lst_z67nhv2rnpcdlol5p3gqox2m",
      displayId: "V-18452",
      category: "Digital Goods",
      risk: 36,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-30T17:43:00+00:00"),
      lastSeen:  new Date("2025-11-16T17:43:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "OnePiece",
      title: "Antidetect FF Browser Ver 5.21 Best For Carders",
      priceUsd: 1.09,
      shipsFrom: "Philippines",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18718" },
    update: {},
    create: {
      id: "lst_rgt1jqowrnw2qj2280ao6zqs",
      displayId: "V-18718",
      category: "Drugs",
      risk: 87,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-09-05T21:58:00+00:00"),
      lastSeen:  new Date("2025-10-01T21:58:00+00:00"),
      status: "flagged",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "cerberus",
      title: "Cialis Pharma Grade Lilly brand 20 x 20mg tablets",
      priceUsd: 75.11,
      shipsFrom: "United Kingdom",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18833" },
    update: {},
    create: {
      id: "lst_5aqh5v94p0io4mf73gplkdf3",
      displayId: "V-18833",
      category: "Drugs",
      risk: 80,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-10-13T03:46:00+00:00"),
      lastSeen:  new Date("2025-11-06T03:46:00+00:00"),
      status: "flagged",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "cerberus",
      title: "Pfizer Viagra x 20 100mg tablets",
      priceUsd: 75.11,
      shipsFrom: "United Kingdom",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18834" },
    update: {},
    create: {
      id: "lst_dpvko5ibgxjdbfufdnc00e3o",
      displayId: "V-18834",
      category: "Drugs",
      risk: 79,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-10-13T13:20:00+00:00"),
      lastSeen:  new Date("2025-11-12T13:20:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "cerberus",
      title: "Pfizer Viagra x 8 100mg tablets",
      priceUsd: 32.65,
      shipsFrom: "United Kingdom",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18836" },
    update: {},
    create: {
      id: "lst_npifa04kcwdnzyyzqio55jl7",
      displayId: "V-18836",
      category: "Drugs",
      risk: 95,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-09-09T06:26:00+00:00"),
      lastSeen:  new Date("2025-10-08T06:26:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "cerberus",
      title: "Pfizer Viagra x 4 100mg tablets",
      priceUsd: 21.77,
      shipsFrom: "United Kingdom",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-28152" },
    update: {},
    create: {
      id: "lst_st1jdxolzc63c1yzpsl5wc9g",
      displayId: "V-28152",
      category: "Guides & Tutorials",
      risk: 26,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-16T22:24:00+00:00"),
      lastSeen:  new Date("2025-11-21T22:24:00+00:00"),
      status: "removed",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "pckabml",
      title: "11th Hour CISSP Study Guide 2nd edition 2014",
      priceUsd: 2.98,
      shipsFrom: "United Kingdom",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-28154" },
    update: {},
    create: {
      id: "lst_r13u0p3iyg14jls5vlkee5sl",
      displayId: "V-28154",
      category: "Security & Hosting",
      risk: 47,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-10T20:44:00+00:00"),
      lastSeen:  new Date("2025-09-15T20:44:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "pckabml",
      title: "50 Android Hacks 2013",
      priceUsd: 2.98,
      shipsFrom: "United Kingdom",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-28156" },
    update: {},
    create: {
      id: "lst_bxybbws14xlmzi3einqwjrkt",
      displayId: "V-28156",
      category: "Security & Hosting",
      risk: 64,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-28T07:11:00+00:00"),
      lastSeen:  new Date("2025-11-05T07:11:00+00:00"),
      status: "removed",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "pckabml",
      title: "Advanced Persistent Threat Hacking - Art and Science",
      priceUsd: 2.98,
      shipsFrom: "United Kingdom",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-28157" },
    update: {},
    create: {
      id: "lst_gpw9tgw1x0rdxbucpysr2rs5",
      displayId: "V-28157",
      category: "Digital Goods",
      risk: 21,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-06T07:58:00+00:00"),
      lastSeen:  new Date("2025-10-18T07:58:00+00:00"),
      status: "removed",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "pckabml",
      title: "Advanced Persistent Threat Understanding the Danger 2013",
      priceUsd: 2.98,
      shipsFrom: "United Kingdom",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-38282" },
    update: {},
    create: {
      id: "lst_pmdwijttpkcro2ykqvcjvrt5",
      displayId: "V-38282",
      category: "Digital Goods",
      risk: 22,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-27T13:21:00+00:00"),
      lastSeen:  new Date("2025-11-05T13:21:00+00:00"),
      status: "removed",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "smart666tiger",
      title: "My Canal accounts (canal+, ocs, canalsat = FULL)",
      priceUsd: 16.35,
      shipsFrom: "Iceland",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-38294" },
    update: {},
    create: {
      id: "lst_zgue535hw8k0pfykzbkp889w",
      displayId: "V-38294",
      category: "Fraud Related",
      risk: 68,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-09-04T06:53:00+00:00"),
      lastSeen:  new Date("2025-10-05T06:53:00+00:00"),
      status: "removed",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "smart666tiger",
      title: "Hacked SunTrust Bank Logins $25,000",
      priceUsd: 223.58,
      shipsFrom: "Iceland",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-38296" },
    update: {},
    create: {
      id: "lst_gswuwqpk2a0pzjxzcr1bp21c",
      displayId: "V-38296",
      category: "Digital Goods",
      risk: 48,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-20T18:44:00+00:00"),
      lastSeen:  new Date("2025-10-26T18:44:00+00:00"),
      status: "flagged",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "smart666tiger",
      title: "Wells-Fargo accounts 1000-5000$",
      priceUsd: 19.86,
      shipsFrom: "Iceland",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-38300" },
    update: {},
    create: {
      id: "lst_200xb1d905ziohqpxglohc2d",
      displayId: "V-38300",
      category: "Digital Goods",
      risk: 32,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-01T00:22:00+00:00"),
      lastSeen:  new Date("2025-10-25T00:22:00+00:00"),
      status: "removed",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "smart666tiger",
      title: "Netflix Premium Account 6 months",
      priceUsd: 9.93,
      shipsFrom: "Iceland",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-11137" },
    update: {},
    create: {
      id: "lst_ejkn7togbsrild1eci2icl4j",
      displayId: "V-11137",
      category: "Drugs",
      risk: 76,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-09-09T11:56:00+00:00"),
      lastSeen:  new Date("2025-09-18T11:56:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "Meds2Buy",
      title: "130 Pills Valium (Roche) 10 MG",
      priceUsd: 159.0,
      shipsFrom: "Philippines",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-11189" },
    update: {},
    create: {
      id: "lst_buamkh1qvnsdiuc89cbuglxx",
      displayId: "V-11189",
      category: "Drugs",
      risk: 83,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-09-19T05:28:00+00:00"),
      lastSeen:  new Date("2025-10-28T05:28:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "Meds2Buy",
      title: "30 Pills Restoril 30 MG",
      priceUsd: 84.46,
      shipsFrom: "Philippines",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-11245" },
    update: {},
    create: {
      id: "lst_5w4qbs0f7ghj8yacz5nlohbi",
      displayId: "V-11245",
      category: "Drugs",
      risk: 93,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-09-01T21:52:00+00:00"),
      lastSeen:  new Date("2025-10-11T21:52:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "Meds2Buy",
      title: "100 Pills Valium (Roche) 10 MG",
      priceUsd: 134.15,
      shipsFrom: "Philippines",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-11246" },
    update: {},
    create: {
      id: "lst_xhkaol9tvqj6tp13v4prf3ws",
      displayId: "V-11246",
      category: "Drugs",
      risk: 66,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-10-31T04:16:00+00:00"),
      lastSeen:  new Date("2025-11-12T04:16:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "Meds2Buy",
      title: "115 Pills Valium (Roche) 10 MG",
      priceUsd: 144.09,
      shipsFrom: "Philippines",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-15750" },
    update: {},
    create: {
      id: "lst_zlprzyc81j3zweilpwplj43p",
      displayId: "V-15750",
      category: "Fraud Related",
      risk: 79,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-09-09T20:16:00+00:00"),
      lastSeen:  new Date("2025-09-24T20:16:00+00:00"),
      status: "removed",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "bank",
      title: "HIGH LIMIT SWISS VISA CARD RELOADABLE LEGIT TUT",
      priceUsd: 9.94,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-15751" },
    update: {},
    create: {
      id: "lst_adeqw4qh959pc3lrohy0xnfc",
      displayId: "V-15751",
      category: "Security & Hosting",
      risk: 57,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-10-16T13:35:00+00:00"),
      lastSeen:  new Date("2025-10-21T13:35:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "bank",
      title: "18 Extensions For Turning Firefox Into a Penetration Testing Tool",
      priceUsd: 4.97,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-15752" },
    update: {},
    create: {
      id: "lst_2q5wr3qyz1ik0641zsvdyckf",
      displayId: "V-15752",
      category: "Fraud Related",
      risk: 57,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-10-31T22:57:00+00:00"),
      lastSeen:  new Date("2025-11-14T22:57:00+00:00"),
      status: "flagged",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "bank",
      title: "PAYPAL CASHOUT 2015 TUTORIALS + BONUS",
      priceUsd: 14.9,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-15753" },
    update: {},
    create: {
      id: "lst_8ozumbmykivugoim6em7eou7",
      displayId: "V-15753",
      category: "Fraud Related",
      risk: 56,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-10-24T11:37:00+00:00"),
      lastSeen:  new Date("2025-12-03T11:37:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "bank",
      title: "5 ATM HACKING TUTORIALS",
      priceUsd: 8.94,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18350" },
    update: {},
    create: {
      id: "lst_pd3xztskdffs1bug891r31fa",
      displayId: "V-18350",
      category: "Erotica",
      risk: 24,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-23T07:14:00+00:00"),
      lastSeen:  new Date("2025-10-29T07:14:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "cyberzen",
      title: "Reality Kings + Naughty America Porn Account [Lifetime+Freebies]",
      priceUsd: 10.9,
      shipsFrom: "Finland",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18355" },
    update: {},
    create: {
      id: "lst_yr76tt7fzpw4jzb9mtpsqc9r",
      displayId: "V-18355",
      category: "Erotica",
      risk: 27,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-22T08:55:00+00:00"),
      lastSeen:  new Date("2025-10-01T08:55:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "cyberzen",
      title: "Brazzers + Mofos + Bangbros + Tiny4k Porn Account [Lifetime]",
      priceUsd: 10.9,
      shipsFrom: "Finland",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18361" },
    update: {},
    create: {
      id: "lst_5xyy84df8dbfiw7i6i45o91y",
      displayId: "V-18361",
      category: "Erotica",
      risk: 26,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-12T16:25:00+00:00"),
      lastSeen:  new Date("2025-11-20T16:25:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "cyberzen",
      title: "BRAZZERS or MOFOS PREMIUM PORN ACCOUNT",
      priceUsd: 2.18,
      shipsFrom: "Finland",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18363" },
    update: {},
    create: {
      id: "lst_t9ja7lvdffr3sh9qlp8klfkw",
      displayId: "V-18363",
      category: "Erotica",
      risk: 15,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-08T08:11:00+00:00"),
      lastSeen:  new Date("2025-10-20T08:11:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "cyberzen",
      title: "Babes.com Premium Porn Account [LIFETIME + FREEBIES]",
      priceUsd: 10.9,
      shipsFrom: "Finland",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18947" },
    update: {},
    create: {
      id: "lst_4zeu5havmkuoegas6c5vpmhu",
      displayId: "V-18947",
      category: "Digital Goods",
      risk: 39,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-07T09:25:00+00:00"),
      lastSeen:  new Date("2025-11-16T09:25:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "darkmarket03",
      title: "MEGAPACK 10000 items - last version",
      priceUsd: 129.19,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-18994" },
    update: {},
    create: {
      id: "lst_4yzhdibhsqi9ud9z9ehpdob6",
      displayId: "V-18994",
      category: "Fraud Related",
      risk: 64,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-09-19T06:27:00+00:00"),
      lastSeen:  new Date("2025-10-31T06:27:00+00:00"),
      status: "flagged",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "darkmarket03",
      title: "100% ORIGINAL Money Laundering Method",
      priceUsd: 0.99,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-19012" },
    update: {},
    create: {
      id: "lst_qbtizgemv1j3nh4f5ktibsv2",
      displayId: "V-19012",
      category: "Fraud Related",
      risk: 75,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-09-21T14:28:00+00:00"),
      lastSeen:  new Date("2025-10-24T14:28:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "darkmarket03",
      title: "100% successful Bank transfers",
      priceUsd: 0.99,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-19013" },
    update: {},
    create: {
      id: "lst_yjjecas2nhzjytwhvwzmdyi1",
      displayId: "V-19013",
      category: "Digital Goods",
      risk: 36,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-01T23:10:00+00:00"),
      lastSeen:  new Date("2025-10-11T23:10:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "darkmarket03",
      title: "100 Ways To Disappear",
      priceUsd: 0.99,
      shipsFrom: "United States",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-25805" },
    update: {},
    create: {
      id: "lst_w99ata9jgeysi5kku4kq8pj0",
      displayId: "V-25805",
      category: "Drugs",
      risk: 92,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-10-13T20:39:00+00:00"),
      lastSeen:  new Date("2025-11-08T20:39:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "montana193",
      title: "Cocaine production at home! 99.9% pure. Full Guide",
      priceUsd: 4.97,
      shipsFrom: "Lithuania",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-25806" },
    update: {},
    create: {
      id: "lst_4n7j26kcmcg8gkaec97q4phk",
      displayId: "V-25806",
      category: "Fraud Related",
      risk: 81,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-10-31T07:43:00+00:00"),
      lastSeen:  new Date("2025-11-24T07:43:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "montana193",
      title: "4 WAYS TO CASHOUT STOLEN CCs TO BTC",
      priceUsd: 1.98,
      shipsFrom: "Lithuania",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-25807" },
    update: {},
    create: {
      id: "lst_qbmex5o521q7ww3e1a99s49s",
      displayId: "V-25807",
      category: "Fraud Related",
      risk: 80,
      signals: ["financial_fraud", "identity_theft"],
      firstSeen: new Date("2025-09-13T04:01:00+00:00"),
      lastSeen:  new Date("2025-09-20T04:01:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "montana193",
      title: "6 ATM HACKING TUTORIALS (LIMITED OFFER)",
      priceUsd: 1.98,
      shipsFrom: "Lithuania",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-25808" },
    update: {},
    create: {
      id: "lst_v23a3ic2gnoyx1aeittevg1q",
      displayId: "V-25808",
      category: "Digital Goods",
      risk: 35,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-10-10T02:29:00+00:00"),
      lastSeen:  new Date("2025-11-10T02:29:00+00:00"),
      status: "flagged",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "montana193",
      title: "$3 Underground E-book \u2013 New Method PP to BTC",
      priceUsd: 1.98,
      shipsFrom: "Lithuania",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-30184" },
    update: {},
    create: {
      id: "lst_ztie5jl3zut2g7s47di2p8ga",
      displayId: "V-30184",
      category: "Drugs",
      risk: 68,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-10-22T14:42:00+00:00"),
      lastSeen:  new Date("2025-11-29T14:42:00+00:00"),
      status: "flagged",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "XTC-Love",
      title: "3.5gr High Quality Moroccan Soft Hash AAA+",
      priceUsd: 39.79,
      shipsFrom: "Netherlands",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-30186" },
    update: {},
    create: {
      id: "lst_dg8lpcv3ohw85p9wm4xjcvek",
      displayId: "V-30186",
      category: "Drugs",
      risk: 80,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-10-31T14:39:00+00:00"),
      lastSeen:  new Date("2025-12-07T14:39:00+00:00"),
      status: "removed",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "XTC-Love",
      title: "3.5gr High Quality Moroccan Soft Hash AAA+ (No FE)",
      priceUsd: 51.23,
      shipsFrom: "Germany",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-30187" },
    update: {},
    create: {
      id: "lst_u56psvo1acc6gar84y0otutt",
      displayId: "V-30187",
      category: "Drugs",
      risk: 95,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-09-29T05:47:00+00:00"),
      lastSeen:  new Date("2025-11-03T05:47:00+00:00"),
      status: "removed",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "XTC-Love",
      title: "3.5gr AAA+ High Quality Afghan Heroin",
      priceUsd: 214.73,
      shipsFrom: "Netherlands",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-30189" },
    update: {},
    create: {
      id: "lst_kgncwl8lqisppk8pnwogvzyi",
      displayId: "V-30189",
      category: "Drugs",
      risk: 76,
      signals: ["drug_sale", "bulk_quantity"],
      firstSeen: new Date("2025-10-19T07:53:00+00:00"),
      lastSeen:  new Date("2025-12-03T07:53:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "XTC-Love",
      title: "3.5gr Pure MDMA Crystals",
      priceUsd: 62.13,
      shipsFrom: "Netherlands",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-32235" },
    update: {},
    create: {
      id: "lst_ezvfsvn1zj55w8gnv6lbynsm",
      displayId: "V-32235",
      category: "Counterfeits",
      risk: 74,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-10-20T16:31:00+00:00"),
      lastSeen:  new Date("2025-12-04T16:31:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "Hackyboy",
      title: "BIG PACK $100/$50/$20/$10 US BILLS PSD TEMPLATES",
      priceUsd: 44.71,
      shipsFrom: "Netherlands",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-32236" },
    update: {},
    create: {
      id: "lst_piyzzqiwzbi2zij6pqhzv82x",
      displayId: "V-32236",
      category: "Erotica",
      risk: 23,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-29T02:45:00+00:00"),
      lastSeen:  new Date("2025-10-22T02:45:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "Hackyboy",
      title: "PREMIUM PORN ACCOUNT LIFETIME + FREEBIES",
      priceUsd: 5.96,
      shipsFrom: "Netherlands",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-32237" },
    update: {},
    create: {
      id: "lst_t5b84sezswic9x3ww2fanysl",
      displayId: "V-32237",
      category: "Digital Goods",
      risk: 28,
      signals: ["digital_goods_sale"],
      firstSeen: new Date("2025-09-22T10:57:00+00:00"),
      lastSeen:  new Date("2025-10-31T10:57:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "Hackyboy",
      title: "U.S. Credit Cards Templates",
      priceUsd: 2.98,
      shipsFrom: "Netherlands",
    },
  })

  await prisma.listing.upsert({
    where: { displayId: "V-32238" },
    update: {},
    create: {
      id: "lst_t3el2uc59h7q3ilfgnvoijke",
      displayId: "V-32238",
      category: "Counterfeits",
      risk: 54,
      signals: ["counterfeit_goods", "replica_luxury"],
      firstSeen: new Date("2025-09-10T07:24:00+00:00"),
      lastSeen:  new Date("2025-09-24T07:24:00+00:00"),
      status: "active",
      sourceId: valhallaSource.id,
      marketplace: "Valhalla",
      vendorAlias: "Hackyboy",
      title: "PSD FILE : GERMAN ID CARD TEMPLATE",
      priceUsd: 4.97,
      shipsFrom: "Netherlands",
    },
  })

  console.log('Listings created: 120')

  // ─── Risk scoring (Risk Engine) ──────────────────────────────────────────
  // The `risk`/`signals` values set on the upserts above are seed-time
  // placeholders only. Here we overwrite them with the output of the real
  // scorer (apps/backend/src/lib/riskEngine.ts) run once against the full
  // just-seeded listing population, so riskEngine.ts stays the single
  // source of truth for both the seed data and the live API
  // (see routes/misc.ts, which recomputes the same way at request time).
  const listingsForScoring = await prisma.listing.findMany({
    select: {
      id: true,
      category: true,
      title: true,
      priceUsd: true,
      marketplace: true,
      vendorAlias: true,
      firstSeen: true,
      lastSeen: true,
    },
  })
  const scoredListings = scoreListings(listingsForScoring)
  for (const [id, result] of scoredListings) {
    await prisma.listing.update({
      where: { id },
      data: { risk: result.score, signals: signalsToDisplayStrings(result.signals) },
    })
  }
  console.log(`Listings risk-scored via riskEngine: ${scoredListings.size}`)

  // ─── Alerts ─────────────────────────────────────────────────────────────────
  // NOTE: this table was previously never seeded, so GET /api/alerts correctly
  // returned [] and the Alert Center rendered empty once the fetch overwrote
  // the mock fallback state. Seeding it here fixes that.

  await prisma.alert.upsert({
    where: { displayId: "ALT-089" },
    update: {},
    create: {
      id: "alt_089k3n6qy1e4mvxg7c2wsd0p",
      displayId: "ALT-089",
      severity: 91,
      title: "Network N-042 crossed critical risk threshold",
      reason: "3 connected high-risk entities, 2 recurring identifiers, abnormal transaction pattern",
      status: "NEW",
      createdAt: new Date(Date.now() - 2 * 60 * 1000),
      entities: {
        create: [
          { entityId: "ent_1xrdh2up5txj6u7usgd8psmf" }, // Hackyboy
          { entityId: "ent_8tobfmrwoq0xap29a8cm4yt8" }, // goldendrugs
        ],
      },
    },
  })

  await prisma.alert.upsert({
    where: { displayId: "ALT-088" },
    update: {},
    create: {
      id: "alt_088h7t2mx9k5qbwvz3ryf1n8",
      displayId: "ALT-088",
      severity: 74,
      title: "New wallet relationship detected in tracked cluster",
      reason: "Wallet linked to known high-risk cluster; cross-source identifier match confidence 87%",
      status: "NEW",
      createdAt: new Date(Date.now() - 14 * 60 * 1000),
      entities: {
        create: [
          { entityId: "ent_lvwg0jr1ws23e7ytwpsgoupu" }, // HappyEyes
        ],
      },
    },
  })

  await prisma.alert.upsert({
    where: { displayId: "ALT-087" },
    update: {},
    create: {
      id: "alt_087d4x8vq2j6ryhw0mtc5b1s",
      displayId: "ALT-087",
      severity: 58,
      title: "Repeated identifier observed across 3 intelligence sources",
      reason: "Same communication identifier appeared across Source Alpha, Beta, and Gamma independently",
      status: "REVIEWED",
      createdAt: new Date(Date.now() - 31 * 60 * 1000),
      entities: {
        create: [
          { entityId: "ent_8gc0m2lwr3qoaocu2h09dmeh" }, // OnePiece
        ],
      },
    },
  })

  await prisma.alert.upsert({
    where: { displayId: "ALT-086" },
    update: {},
    create: {
      id: "alt_086w5n1jk8v3rytc6qm2b9zx",
      displayId: "ALT-086",
      severity: 45,
      title: "Listing activity spike in monitored category",
      reason: "Listing frequency increased 340% over baseline in a 4-hour window",
      status: "REVIEWED",
      createdAt: new Date(Date.now() - 72 * 60 * 1000),
      entities: { create: [] },
    },
  })

  await prisma.alert.upsert({
    where: { displayId: "ALT-085" },
    update: {},
    create: {
      id: "alt_085q9c3fw7m1xvbz4trh6y2k",
      displayId: "ALT-085",
      severity: 91,
      title: "Entity resolution confidence exceeded 95% threshold",
      reason: "Cross-source entity correlation achieved 96% match confidence across 3 independent sources",
      status: "RESOLVED",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      entities: {
        create: [
          { entityId: "ent_73ueeguxfcv4jp6qpoy1sc0q" }, // RepAAA
        ],
      },
    },
  })

  await prisma.alert.upsert({
    where: { displayId: "ALT-084" },
    update: {},
    create: {
      id: "alt_084r6y0hb4n8wzkx1sq7c3md",
      displayId: "ALT-084",
      severity: 62,
      title: "Blockchain cluster Cluster-C1 shows abnormal outflow",
      reason: "Transaction volume 5.2x above 30-day moving average; timing correlation with listing activity",
      status: "RESOLVED",
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      entities: {
        create: [
          { entityId: "ent_2fazmtzljxq1u25vcqrzr1yi" }, // DUTCHBULK
        ],
      },
    },
  })

  console.log('Alerts created: 6')

  // ─── Wallets ────────────────────────────────────────────────────────────────
  // Same issue as Alert: table was never seeded, so /api/wallets returned []
  // regardless of the txnCount/entityCount field-name fix in the frontend.

  await prisma.wallet.upsert({
    where: { displayId: "WALLET-W1" },
    update: {},
    create: {
      id: "wal_w1a9k4n7t2vqmxz6ryc0h5bd",
      displayId: "WALLET-W1",
      risk: 87,
      txnCount: 42,
      entityCount: 8,
      cluster: "Cluster-C1",
      firstSeen: new Date("2026-08-12T00:00:00+00:00"),
      lastSeen: new Date("2026-08-16T00:00:00+00:00"),
      totalVolume: "4.73 BTC-eq",
      flagged: true,
    },
  })

  await prisma.wallet.upsert({
    where: { displayId: "WALLET-W2" },
    update: {},
    create: {
      id: "wal_w2c7m3x9q1vryhz5tbk0n8f4",
      displayId: "WALLET-W2",
      risk: 74,
      txnCount: 28,
      entityCount: 5,
      cluster: "Cluster-C1",
      firstSeen: new Date("2026-08-10T00:00:00+00:00"),
      lastSeen: new Date("2026-08-15T00:00:00+00:00"),
      totalVolume: "2.18 BTC-eq",
      flagged: true,
    },
  })

  await prisma.wallet.upsert({
    where: { displayId: "WALLET-W3" },
    update: {},
    create: {
      id: "wal_w3f2b8h5k1tyrvz9mqxc4n7d",
      displayId: "WALLET-W3",
      risk: 61,
      txnCount: 15,
      entityCount: 3,
      cluster: "Cluster-C2",
      firstSeen: new Date("2026-08-08T00:00:00+00:00"),
      lastSeen: new Date("2026-08-14T00:00:00+00:00"),
      totalVolume: "0.94 BTC-eq",
      flagged: false,
    },
  })

  await prisma.wallet.upsert({
    where: { displayId: "WALLET-W4" },
    update: {},
    create: {
      id: "wal_w4n6q0v3x8tzrymb1hc5k9f",
      displayId: "WALLET-W4",
      risk: 44,
      txnCount: 9,
      entityCount: 2,
      cluster: "Cluster-C2",
      firstSeen: new Date("2026-08-07T00:00:00+00:00"),
      lastSeen: new Date("2026-08-13T00:00:00+00:00"),
      totalVolume: "0.41 BTC-eq",
      flagged: false,
    },
  })

  await prisma.wallet.upsert({
    where: { displayId: "WALLET-W5" },
    update: {},
    create: {
      id: "wal_w5k1c4m8b0tyrxq7nzv3h6f",
      displayId: "WALLET-W5",
      risk: 31,
      txnCount: 6,
      entityCount: 1,
      cluster: "Cluster-C3",
      firstSeen: new Date("2026-08-05T00:00:00+00:00"),
      lastSeen: new Date("2026-08-12T00:00:00+00:00"),
      totalVolume: "0.17 BTC-eq",
      flagged: false,
    },
  })

  console.log('Wallets created: 5')

  // ─── Extra sources used by Evidence records ─────────────────────────────────
  // Only the two marketplace sources existed before; evidence needs a few
  // non-marketplace ones too ("Blockchain Data", "System", etc).

  const sourceAlpha = await prisma.source.upsert({
    where: { name: "Source Alpha" }, update: {},
    create: { id: "src_alpha1n2t3e4l5f6e7e8d9", name: "Source Alpha", type: "Intelligence feed", access: SourceAccess.AUTHORIZED },
  })
  const sourceBeta = await prisma.source.upsert({
    where: { name: "Source Beta" }, update: {},
    create: { id: "src_beta1n2t3e4l5f6e7e8d9", name: "Source Beta", type: "Intelligence feed", access: SourceAccess.AUTHORIZED },
  })
  const sourceGamma = await prisma.source.upsert({
    where: { name: "Source Gamma" }, update: {},
    create: { id: "src_gamma1n2t3e4l5f6e7e8", name: "Source Gamma", type: "Intelligence feed", access: SourceAccess.PUBLIC },
  })
  const sourceBlockchain = await prisma.source.upsert({
    where: { name: "Blockchain Data" }, update: {},
    create: { id: "src_chain1b2l3o4c5k6d7a8", name: "Blockchain Data", type: "Blockchain data", access: SourceAccess.SYNTHETIC },
  })
  const sourceSystem = await prisma.source.upsert({
    where: { name: "System" }, update: {},
    create: { id: "src_system1i2n3t4e5r6n7a", name: "System", type: "System", access: SourceAccess.AUTHORIZED },
  })

  console.log('Sources created: 5 additional')

  // ─── Networks ───────────────────────────────────────────────────────────────
  // Previously unseeded — this is why the Overview "Emerging Networks" table,
  // Alert.network and Investigation.network relations, and Network Graph all
  // had nothing real to point at.

  const netN042 = await prisma.network.upsert({
    where: { displayId: "N-042" }, update: {},
    create: { id: "net_n042a1b2c3d4e5f6g7h8i9", displayId: "N-042", risk: 91, change: 59, status: "CRITICAL", lastActivity: new Date(Date.now() - 2 * 60 * 1000) },
  })
  const netN018 = await prisma.network.upsert({
    where: { displayId: "N-018" }, update: {},
    create: { id: "net_n018b2c3d4e5f6g7h8i9j0", displayId: "N-018", risk: 78, change: 31, status: "HIGH", lastActivity: new Date(Date.now() - 18 * 60 * 1000) },
  })
  const netN067 = await prisma.network.upsert({
    where: { displayId: "N-067" }, update: {},
    create: { id: "net_n067c3d4e5f6g7h8i9j0k1", displayId: "N-067", risk: 72, change: 24, status: "HIGH", lastActivity: new Date(Date.now() - 60 * 60 * 1000) },
  })
  const netN031 = await prisma.network.upsert({
    where: { displayId: "N-031" }, update: {},
    create: { id: "net_n031d4e5f6g7h8i9j0k1l2", displayId: "N-031", risk: 65, change: 19, status: "HIGH", lastActivity: new Date(Date.now() - 3 * 60 * 60 * 1000) },
  })
  const netN009 = await prisma.network.upsert({
    where: { displayId: "N-009" }, update: {},
    create: { id: "net_n009e5f6g7h8i9j0k1l2m3", displayId: "N-009", risk: 58, change: 14, status: "MEDIUM", lastActivity: new Date(Date.now() - 6 * 60 * 60 * 1000) },
  })

  // Attach a handful of already-seeded entities to networks so the
  // "entities" counts on Overview/Investigations aren't zero.
  await prisma.entity.update({ where: { displayId: "Hackyboy" },    data: { networkId: netN042.id } })
  await prisma.entity.update({ where: { displayId: "goldendrugs" }, data: { networkId: netN042.id } })
  await prisma.entity.update({ where: { displayId: "HappyEyes" },   data: { networkId: netN042.id } })
  await prisma.entity.update({ where: { displayId: "OnePiece" },    data: { networkId: netN018.id } })
  await prisma.entity.update({ where: { displayId: "RepAAA" },      data: { networkId: netN018.id } })
  await prisma.entity.update({ where: { displayId: "DUTCHBULK" },       data: { networkId: netN067.id } })
  await prisma.entity.update({ where: { displayId: "Doug-Heffernan" },  data: { networkId: netN067.id } })
  await prisma.entity.update({ where: { displayId: "montana193" }, data: { networkId: netN031.id } })
  await prisma.entity.update({ where: { displayId: "cerberus" },   data: { networkId: netN031.id } })
  await prisma.entity.update({ where: { displayId: "Junkiepig666" }, data: { networkId: netN009.id } })

  console.log('Networks created: 5')

  // ─── Network risk history (Risk Evolution chart) ────────────────────────────
  // Networks above have a final risk/change/status but, until now, zero
  // NetworkRiskPoint rows — so GET /:displayId/trajectory returned an empty
  // riskPoints array and the Network Risk Analysis screen's "Risk Evolution"
  // chart showed "No historical risk data available yet." on a fresh seed.
  // This backfills ~1 month (30 days) of history per network, ending at its
  // current persisted `risk` (recorded at `lastActivity`, matching the "Last
  // Activity" shown in the UI) with the final jump sized to roughly match
  // `change`, so it lines up with the "changed +N pts on the last pipeline
  // event" banner text. Guarded by a count check so re-running the seed
  // script is idempotent and never duplicates points (and won't clobber real
  // trajectory data produced by /api/simulate/event or /recalculate).
  type HistoricalRiskPoint = { daysAgo: number; score: number }

  async function seedNetworkRiskHistory(
    network: { id: string; lastActivity: Date },
    points: HistoricalRiskPoint[]
  ) {
    const existing = await prisma.networkRiskPoint.count({ where: { networkId: network.id } })
    if (existing > 0) return // already has trajectory data — don't duplicate

    await prisma.networkRiskPoint.createMany({
      data: points.map(({ daysAgo, score }) => ({
        networkId: network.id,
        label: daysAgo === 0 ? `Recalculated: ${network.lastActivity.toISOString()}` : `Day -${daysAgo}`,
        score,
        recordedAt:
          daysAgo === 0
            ? network.lastActivity
            : new Date(network.lastActivity.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      })),
    })
  }

  await seedNetworkRiskHistory(netN042, [
    { daysAgo: 30, score: 24 }, { daysAgo: 26, score: 26 }, { daysAgo: 22, score: 25 },
    { daysAgo: 18, score: 28 }, { daysAgo: 14, score: 30 }, { daysAgo: 10, score: 32 },
    { daysAgo: 7, score: 33 }, { daysAgo: 4, score: 32 }, { daysAgo: 2, score: 33 },
    { daysAgo: 1, score: 32 }, { daysAgo: 0, score: 91 },
  ])
  await seedNetworkRiskHistory(netN018, [
    { daysAgo: 30, score: 40 }, { daysAgo: 26, score: 42 }, { daysAgo: 22, score: 41 },
    { daysAgo: 18, score: 43 }, { daysAgo: 14, score: 45 }, { daysAgo: 10, score: 44 },
    { daysAgo: 7, score: 46 }, { daysAgo: 4, score: 47 }, { daysAgo: 2, score: 47 },
    { daysAgo: 1, score: 47 }, { daysAgo: 0, score: 78 },
  ])
  await seedNetworkRiskHistory(netN067, [
    { daysAgo: 30, score: 38 }, { daysAgo: 26, score: 40 }, { daysAgo: 22, score: 39 },
    { daysAgo: 18, score: 41 }, { daysAgo: 14, score: 43 }, { daysAgo: 10, score: 44 },
    { daysAgo: 7, score: 46 }, { daysAgo: 4, score: 47 }, { daysAgo: 2, score: 48 },
    { daysAgo: 1, score: 48 }, { daysAgo: 0, score: 72 },
  ])
  await seedNetworkRiskHistory(netN031, [
    { daysAgo: 30, score: 36 }, { daysAgo: 26, score: 38 }, { daysAgo: 22, score: 37 },
    { daysAgo: 18, score: 39 }, { daysAgo: 14, score: 41 }, { daysAgo: 10, score: 42 },
    { daysAgo: 7, score: 44 }, { daysAgo: 4, score: 45 }, { daysAgo: 2, score: 46 },
    { daysAgo: 1, score: 46 }, { daysAgo: 0, score: 65 },
  ])
  await seedNetworkRiskHistory(netN009, [
    { daysAgo: 30, score: 34 }, { daysAgo: 26, score: 36 }, { daysAgo: 22, score: 35 },
    { daysAgo: 18, score: 37 }, { daysAgo: 14, score: 39 }, { daysAgo: 10, score: 40 },
    { daysAgo: 7, score: 41 }, { daysAgo: 4, score: 42 }, { daysAgo: 2, score: 43 },
    { daysAgo: 1, score: 44 }, { daysAgo: 0, score: 58 },
  ])

  console.log('Network risk history seeded: ~1 month per network')

  // ─── Network graph (GraphNode / GraphEdge) ───────────────────────────────────
  // Previously unseeded, so GET /api/graph returned { nodes: [], edges: [] }.
  // Because the frontend only overwrites its mock nodes/edges when the
  // response is non-empty, the Network Graph screen silently kept showing
  // the hardcoded demo layout with no error and no indication anything
  // was wrong — seeding this table is the actual fix.

  await prisma.graphNode.upsert({
    where: { id: "gph_alias_x" }, update: {},
    create: { id: "gph_alias_x", label: "Alias_X", type: "ENTITY", risk: 84, x: 420, y: 240, entityId: "ent_1xrdh2up5txj6u7usgd8psmf" },
  })
  await prisma.graphNode.upsert({
    where: { id: "gph_alias_y" }, update: {},
    create: { id: "gph_alias_y", label: "Alias_Y", type: "ENTITY", risk: 71, x: 680, y: 180, entityId: "ent_lvwg0jr1ws23e7ytwpsgoupu" },
  })
  await prisma.graphNode.upsert({
    where: { id: "gph_market_a" }, update: {},
    create: { id: "gph_market_a", label: "Marketplace_A", type: "MARKET", risk: 72, x: 240, y: 340 },
  })
  await prisma.graphNode.upsert({
    where: { id: "gph_market_b" }, update: {},
    create: { id: "gph_market_b", label: "Marketplace_B", type: "MARKET", risk: 49, x: 330, y: 150 },
  })
  await prisma.graphNode.upsert({
    where: { id: "gph_listing_17" }, update: {},
    create: { id: "gph_listing_17", label: "Listing_017", type: "LISTING", risk: 58, x: 148, y: 460 },
  })
  await prisma.graphNode.upsert({
    where: { id: "gph_wallet_w1" }, update: {},
    create: { id: "gph_wallet_w1", label: "Wallet_W1", type: "WALLET", risk: 87, x: 560, y: 350 },
  })
  await prisma.graphNode.upsert({
    where: { id: "gph_wallet_w2" }, update: {},
    create: { id: "gph_wallet_w2", label: "Wallet_W2", type: "WALLET", risk: 74, x: 620, y: 480 },
  })
  await prisma.graphNode.upsert({
    where: { id: "gph_comm_04" }, update: {},
    create: { id: "gph_comm_04", label: "Comm_ID_04", type: "COMM", risk: 62, x: 520, y: 130 },
  })
  await prisma.graphNode.upsert({
    where: { id: "gph_txn_001" }, update: {},
    create: { id: "gph_txn_001", label: "Txn_3f8a", type: "TXN", risk: 55, x: 690, y: 380 },
  })
  await prisma.graphNode.upsert({
    where: { id: "gph_alias_z" }, update: {},
    create: { id: "gph_alias_z", label: "Alias_Z", type: "ENTITY", risk: 52, x: 780, y: 290, entityId: "ent_8gc0m2lwr3qoaocu2h09dmeh" },
  })

  const graphEdgeSeeds: [string, string, string][] = [
    ["gph_alias_x", "gph_market_a", "Appeared On"],
    ["gph_alias_x", "gph_market_b", "Appeared On"],
    ["gph_alias_x", "gph_wallet_w1", "Transacted With"],
    ["gph_alias_x", "gph_comm_04", "Linked To"],
    ["gph_market_a", "gph_listing_17", "Contains"],
    ["gph_wallet_w1", "gph_wallet_w2", "Transacted With"],
    ["gph_wallet_w1", "gph_alias_y", "Associated With"],
    ["gph_wallet_w2", "gph_txn_001", "Transacted With"],
    ["gph_alias_y", "gph_market_a", "Appeared On"],
    ["gph_alias_y", "gph_alias_z", "Shared Identifier"],
    ["gph_txn_001", "gph_alias_z", "Associated With"],
  ]
  for (const [fromId, toId, label] of graphEdgeSeeds) {
    const id = `gph_edge_${fromId}_${toId}`
    await prisma.graphEdge.upsert({
      where: { id }, update: {},
      create: { id, fromId, toId, label },
    })
  }

  console.log('Graph nodes/edges created: 10 / 11')

  // ─── Investigations ───────────────────────────────────────────────────────

  const inv042 = await prisma.investigation.upsert({
    where: { displayId: "INV-2026-042" }, update: {},
    create: {
      id: "inv_042a1b2c3d4e5f6g7h8i9j0",
      displayId: "INV-2026-042",
      title: "Emerging Network Investigation",
      description: "Cross-source network N-042 investigation following early-warning trigger on Aug 16, 2026. Primary entity Alias_X resolved with 93% confidence across 4 sources.",
      status: "UNDER_INVESTIGATION",
      priority: "HIGH",
      assignee: "Investigator A",
      networkId: netN042.id,
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 4 * 60 * 1000),
      entities: { create: [
        { entityId: "ent_1xrdh2up5txj6u7usgd8psmf" }, // Hackyboy
        { entityId: "ent_8tobfmrwoq0xap29a8cm4yt8" }, // goldendrugs
        { entityId: "ent_lvwg0jr1ws23e7ytwpsgoupu" }, // HappyEyes
      ] },
    },
  })

  const inv039 = await prisma.investigation.upsert({
    where: { displayId: "INV-2026-039" }, update: {},
    create: {
      id: "inv_039b2c3d4e5f6g7h8i9j0k1",
      displayId: "INV-2026-039",
      title: "Cross-Source Entity Resolution",
      description: "Entity resolution case for Username_X23 cluster. Multiple aliases identified with high confidence.",
      status: "UNDER_INVESTIGATION",
      priority: "HIGH",
      assignee: "Investigator B",
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 60 * 60 * 1000),
      entities: { create: [
        { entityId: "ent_8gc0m2lwr3qoaocu2h09dmeh" }, // OnePiece
        { entityId: "ent_73ueeguxfcv4jp6qpoy1sc0q" }, // RepAAA
      ] },
    },
  })

  const inv031 = await prisma.investigation.upsert({
    where: { displayId: "INV-2026-031" }, update: {},
    create: {
      id: "inv_031c3d4e5f6g7h8i9j0k1l2",
      displayId: "INV-2026-031",
      title: "Wallet Cluster Analysis",
      description: "Blockchain cluster Cluster-C1 analysis following abnormal outflow detection.",
      status: "UNDER_REVIEW",
      priority: "MEDIUM",
      assignee: "Investigator A",
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      entities: { create: [
        { entityId: "ent_2fazmtzljxq1u25vcqrzr1yi" }, // DUTCHBULK
      ] },
    },
  })

  const inv028 = await prisma.investigation.upsert({
    where: { displayId: "INV-2026-028" }, update: {},
    create: {
      id: "inv_028d4e5f6g7h8i9j0k1l2m3",
      displayId: "INV-2026-028",
      title: "Marketplace Activity Monitoring",
      description: "Ongoing monitoring of Source Alpha and Source Beta listing patterns.",
      status: "MONITORING",
      priority: "MEDIUM",
      assignee: "Investigator C",
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      entities: { create: [
        { entityId: "ent_71kf7ep57waaq4s375mblf7d" }, // montana193
        { entityId: "ent_bus6n2achj04ej8dqgy1m7al" }, // cerberus
      ] },
    },
  })

  const inv019 = await prisma.investigation.upsert({
    where: { displayId: "INV-2026-019" }, update: {},
    create: {
      id: "inv_019e5f6g7h8i9j0k1l2m3n4",
      displayId: "INV-2026-019",
      title: "Historical Pattern Analysis",
      description: "Completed retrospective analysis of Aug 1–10 baseline patterns.",
      status: "CLOSED",
      priority: "LOW",
      assignee: "Investigator B",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      entities: { create: [
        { entityId: "ent_w3sep9t5l55xsksbmestqdtt" }, // Junkiepig666
      ] },
    },
  })

  console.log('Investigations created: 5')

  // ─── Evidence ───────────────────────────────────────────────────────────────

  await prisma.evidenceRecord.upsert({
    where: { displayId: "EV-1029" }, update: {},
    create: {
      id: "evd_1029a1b2c3d4e5f6g7h8i9",
      displayId: "EV-1029",
      type: "Intelligence Record",
      hash: "7A9F3C2D1B4E8A6F93C0D5B2E7F1A4C8",
      uploadedBy: "Investigator A",
      status: "VERIFIED",
      sourceId: sourceAlpha.id,
      investigationId: inv042.id,
      createdAt: new Date("2026-08-16T19:32:00+00:00"),
    },
  })
  await prisma.evidenceRecord.upsert({
    where: { displayId: "EV-1028" }, update: {},
    create: {
      id: "evd_1028b2c3d4e5f6g7h8i9j0",
      displayId: "EV-1028",
      type: "Wallet Transaction Log",
      hash: "B2E4F8A1C6D9E3B72A5C8F0D4E7B1A9C",
      uploadedBy: "Investigator A",
      status: "VERIFIED",
      sourceId: sourceBlockchain.id,
      investigationId: inv042.id,
      createdAt: new Date("2026-08-16T18:47:00+00:00"),
    },
  })
  await prisma.evidenceRecord.upsert({
    where: { displayId: "EV-1025" }, update: {},
    create: {
      id: "evd_1025c3d4e5f6g7h8i9j0k1",
      displayId: "EV-1025",
      type: "Communication Record",
      hash: "C4A8E2D7F1B3C9A5E6D0F2B4C8A1E7D3",
      uploadedBy: "Investigator B",
      status: "PENDING",
      sourceId: sourceBeta.id,
      investigationId: inv042.id,
      createdAt: new Date("2026-08-15T14:22:00+00:00"),
    },
  })
  await prisma.evidenceRecord.upsert({
    where: { displayId: "EV-1021" }, update: {},
    create: {
      id: "evd_1021d4e5f6g7h8i9j0k1l2",
      displayId: "EV-1021",
      type: "Network Analysis Report",
      hash: "D6B2C4E8F3A7B1C9D5E2A4F6B8C0D3E7",
      uploadedBy: "System",
      status: "VERIFIED",
      sourceId: sourceSystem.id,
      investigationId: inv039.id,
      createdAt: new Date("2026-08-14T10:05:00+00:00"),
    },
  })
  await prisma.evidenceRecord.upsert({
    where: { displayId: "EV-1018" }, update: {},
    create: {
      id: "evd_1018e5f6g7h8i9j0k1l2m3",
      displayId: "EV-1018",
      type: "Intelligence Record",
      hash: "E8D4A6C2B8F5C3D1E7A9B3C5D8F2A0E4",
      uploadedBy: "Investigator B",
      status: "VERIFIED",
      sourceId: sourceGamma.id,
      investigationId: inv039.id,
      createdAt: new Date("2026-08-13T16:30:00+00:00"),
    },
  })
  await prisma.evidenceRecord.upsert({
    where: { displayId: "EV-1015" }, update: {},
    create: {
      id: "evd_1015f6g7h8i9j0k1l2m3n4",
      displayId: "EV-1015",
      type: "Listing Capture",
      hash: "F1A3C5E7B9D2F4A6C8E0B2D4F6A8C0E2",
      uploadedBy: "System",
      status: "VERIFIED",
      sourceId: sourceAlpha.id,
      investigationId: inv042.id,
      createdAt: new Date("2026-08-12T09:14:00+00:00"),
    },
  })

  console.log('Evidence records created: 6')

  // ─── Audit log ──────────────────────────────────────────────────────────────

  const auditLogSeeds = [
    { id: "adt_001a1b2c3d4e5f6g7h8i9j", user: "Investigator A", action: "Generated Report",       resource: "INV-2026-042", ip: "10.0.1.47", type: "export", minsAgo: 3 },
    { id: "adt_002b2c3d4e5f6g7h8i9j0k", user: "Investigator A", action: "Added Evidence",         resource: "EV-1029",      ip: "10.0.1.47", type: "write",  minsAgo: 6 },
    { id: "adt_003c3d4e5f6g7h8i9j0k1l", user: "Investigator A", action: "Viewed Entity",          resource: "Hackyboy",     ip: "10.0.1.47", type: "read",   minsAgo: 8 },
    { id: "adt_004d4e5f6g7h8i9j0k1l2m", user: "Investigator B", action: "Exported Data",          resource: "INV-2026-039", ip: "10.0.2.33", type: "export", minsAgo: 12 },
    { id: "adt_005e5f6g7h8i9j0k1l2m3n", user: "Investigator A", action: "Created Investigation",  resource: "INV-2026-042", ip: "10.0.1.47", type: "write",  minsAgo: 15 },
    { id: "adt_006f6g7h8i9j0k1l2m3n4o", user: "Admin",          action: "Modified Permissions",   resource: "Investigator C", ip: "10.0.0.1", type: "admin", minsAgo: 18 },
    { id: "adt_007g7h8i9j0k1l2m3n4o5p", user: "Investigator C", action: "Viewed Alert",           resource: "ALT-089",      ip: "10.0.3.12", type: "read",   minsAgo: 22 },
    { id: "adt_008h8i9j0k1l2m3n4o5p6q", user: "Investigator B", action: "Ran Search",             resource: "Query: Hackyboy", ip: "10.0.2.33", type: "search", minsAgo: 27 },
    { id: "adt_009i9j0k1l2m3n4o5p6q7r", user: "System",         action: "Alert Generated",        resource: "ALT-089",      ip: "Internal",  type: "system", minsAgo: 31 },
    { id: "adt_010j0k1l2m3n4o5p6q7r8s", user: "Investigator A", action: "Viewed Network Graph",   resource: "N-042",        ip: "10.0.1.47", type: "read",   minsAgo: 34 },
  ]
  for (const entry of auditLogSeeds) {
    await prisma.auditLogEntry.upsert({
      where: { id: entry.id },
      update: {},
      create: {
        id: entry.id,
        user: entry.user,
        action: entry.action,
        resource: entry.resource,
        ip: entry.ip,
        type: entry.type,
        status: "Success",
        createdAt: new Date(Date.now() - entry.minsAgo * 60 * 1000),
      },
    })
  }

  console.log('Audit log entries created: 10')

  // ─── Prompt templates ───────────────────────────────────────────────────────
  // The AI Assessment prompt lives here, not hardcoded in application code, so
  // it can be reviewed/tuned as data. lib/investigationAssessment.ts fetches
  // this row by `key` and falls back to a built-in default only if it's ever
  // missing (e.g. a fresh DB that hasn't been seeded yet).

  await prisma.promptTemplate.upsert({
    where: { key: 'ai_assessment' },
    update: {},
    create: {
      key: 'ai_assessment',
      systemInstruction: 'You are a criminal intelligence analysis assistant. Always respond with valid JSON only.',
      template: `You are assisting a criminal-intelligence investigator reviewing case {{displayId}} ("{{title}}").

Case summary: {{description}}
Status: {{status}} · Priority: {{priority}}
Computed risk score: {{score}}/100 — this was derived deterministically from the signals below; do not recompute, restate as different, or contradict this number.

Contributing signals:
{{signalLines}}

Return a JSON object with exactly two fields:
1. "explanation": a concise (3-5 sentence) plain-English assessment of why this case scored {{score}}/100, grounded ONLY in the signals and case summary above. Do not invent entities, wallets, or facts not present above.
2. "recommendedNext": an array of 3-5 concrete, specific next investigative steps, grounded in the entities/network/evidence referenced above.

This is a decision-support tool only — conclusions require investigator review and do not constitute a criminal determination.`,
    },
  })

  console.log('Prompt templates created: 1')
  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })