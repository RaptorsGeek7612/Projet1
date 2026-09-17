import { describe, expect, it } from "vitest";
import { encodeFunctionData } from "viem";
import { IdentityRegistryAbi } from "../abis/trex";
import {
  classifyBalanceTransition,
  classifyFreezeTransition,
  computeCountryMove,
  decodeRegisteredCountry,
  eventId,
} from "./logic";

describe("eventId", () => {
  it("combine le hash de transaction et l'index du log", () => {
    expect(eventId({ transaction: { hash: "0xabc" }, log: { logIndex: 3 } })).toBe("0xabc-3");
  });
});

describe("classifyBalanceTransition", () => {
  it("détecte l'entrée d'un nouveau porteur (0 -> non nul)", () => {
    const r = classifyBalanceTransition(0n, 100n);
    expect(r).toEqual({ next: 100n, becameHolder: true, leftRegister: false });
  });

  it("détecte la sortie d'un porteur (non nul -> 0)", () => {
    const r = classifyBalanceTransition(100n, -100n);
    expect(r).toEqual({ next: 0n, becameHolder: false, leftRegister: true });
  });

  it("ne signale aucune transition pour un porteur déjà actif", () => {
    const r = classifyBalanceTransition(100n, 50n);
    expect(r).toEqual({ next: 150n, becameHolder: false, leftRegister: false });
  });

  it("ne signale aucune transition si le solde reste à 0", () => {
    const r = classifyBalanceTransition(0n, 0n);
    expect(r).toEqual({ next: 0n, becameHolder: false, leftRegister: false });
  });
});

describe("classifyFreezeTransition", () => {
  it("signale un changement lors d'un premier gel", () => {
    expect(classifyFreezeTransition(false, true)).toEqual({ changed: true, step: 1 });
  });

  it("signale un changement lors d'un dégel", () => {
    expect(classifyFreezeTransition(true, false)).toEqual({ changed: true, step: -1 });
  });

  it("ne signale AUCUN changement sur un événement redondant (déjà gelé, regelé)", () => {
    // Le bug corrigé : setAddressFrozen(true) sur une adresse déjà gelée
    // émet quand même AddressFrozen, sans garde-fou frozenHolderCount dérive.
    expect(classifyFreezeTransition(true, true)).toEqual({ changed: false, step: 0 });
  });

  it("ne signale aucun changement sur un dégel redondant", () => {
    expect(classifyFreezeTransition(false, false)).toEqual({ changed: false, step: 0 });
  });
});

describe("computeCountryMove", () => {
  it("ne fait rien si le porteur n'existait pas encore", () => {
    expect(computeCountryMove(undefined, 250)).toEqual({ from: null, to: null });
  });

  it("ne fait rien si le porteur n'a aucun solde (enregistré mais pas encore financé)", () => {
    expect(computeCountryMove({ country: null, balance: 0n }, 250)).toEqual({ from: null, to: null });
  });

  it("ne fait rien si le pays ne change pas", () => {
    expect(computeCountryMove({ country: 250, balance: 100n }, 250)).toEqual({ from: null, to: null });
  });

  it("déplace un porteur avec solde d'un pays vers un autre", () => {
    const move = computeCountryMove({ country: 250, balance: 900n }, 840);
    expect(move).toEqual({
      from: { country: 250, balance: 900n },
      to: { country: 840, balance: 900n },
    });
  });

  it("affecte un premier pays sans décrémenter (avant: aucun pays connu)", () => {
    // Cas du bug corrigé : registerIdentity() sans CountryUpdated préalable.
    const move = computeCountryMove({ country: null, balance: 100n }, 840);
    expect(move).toEqual({ from: null, to: { country: 840, balance: 100n } });
  });
});

const IR_ADDRESS = "0xafe7308c10f26c6cc5e0d83938dc10d421704c23" as const;
const INVESTOR = "0x6b3d16c808e8084bbc679292b3914385ef032ceb" as const;
const OTHER_INVESTOR = "0xdbc656a8caba1b28b3247b9aee9cb7d9ebdba4fb" as const;
const IDENTITY = "0x8a2eef20717ccb7d7484a4f634a13d44f09e1bc3" as const;
const OTHER_IDENTITY = "0x3447beb1d0f78dd728faf671ba9411bda7881c98" as const;

describe("decodeRegisteredCountry", () => {
  it("décode le pays depuis un appel direct à registerIdentity()", () => {
    const data = encodeFunctionData({
      abi: IdentityRegistryAbi,
      functionName: "registerIdentity",
      args: [INVESTOR, IDENTITY, 250],
    });
    expect(decodeRegisteredCountry(data, INVESTOR)).toBe(250);
  });

  it("décode le pays du bon investisseur depuis un batchRegisterIdentity()", () => {
    const data = encodeFunctionData({
      abi: IdentityRegistryAbi,
      functionName: "batchRegisterIdentity",
      args: [
        [INVESTOR, OTHER_INVESTOR],
        [IDENTITY, OTHER_IDENTITY],
        [250, 840],
      ],
    });
    expect(decodeRegisteredCountry(data, INVESTOR)).toBe(250);
    expect(decodeRegisteredCountry(data, OTHER_INVESTOR)).toBe(840);
  });

  it("retourne null si l'adresse n'apparaît pas dans le batch", () => {
    const data = encodeFunctionData({
      abi: IdentityRegistryAbi,
      functionName: "batchRegisterIdentity",
      args: [[OTHER_INVESTOR], [OTHER_IDENTITY], [840]],
    });
    expect(decodeRegisteredCountry(data, INVESTOR)).toBeNull();
  });

  it("retourne null pour un calldata qui ne correspond à aucune des deux signatures (ex. via un contrat intermédiaire)", () => {
    expect(decodeRegisteredCountry("0x12345678deadbeef", INVESTOR)).toBeNull();
  });
});
