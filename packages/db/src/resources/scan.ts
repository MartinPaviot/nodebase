/**
 * Scan Resource
 *
 * Provides permission-checked access to ScanResult records.
 */

import { PermissionError, type ScanCategory, type ScanSignal } from "@nodebase/types";
import { prisma } from "../client";
import {
  BaseResource,
  type ResourceAuth,
  type QueryOptions,
  buildQueryOptions,
  workspaceScope,
} from "./base";

// Type for ScanResult (to be added to Prisma schema)
interface ScanResultData {
  id: string;
  workspaceId: string;
  category: ScanCategory;
  signals: ScanSignal[];
  scannedAt: Date;
}

export class ScanResource extends BaseResource<ScanResultData> {
  // ============================================
  // Static Factory Methods
  // ============================================

  /**
   * Find a scan result by ID with permission check.
   */
  static async findById(
    id: string,
    auth: ResourceAuth
  ): Promise<ScanResource | null> {
    const scan = await prisma.scanResult.findUnique({
      where: { id },
    });

    if (!scan) return null;

    if (scan.workspaceId !== auth.workspaceId) {
      throw new PermissionError(auth.userId, "ScanResult", "read");
    }

    return new ScanResource(
      {
        ...scan,
        category: scan.category as ScanCategory,
        signals: scan.signals as ScanSignal[],
      },
      auth
    );
  }

  /**
   * Find all scan results in the workspace.
   */
  static async findAll(
    auth: ResourceAuth,
    options?: QueryOptions
  ): Promise<ScanResource[]> {
    const scans = await prisma.scanResult.findMany({
      where: workspaceScope(auth),
      ...buildQueryOptions(options),
    });

    return scans.map(
      (scan: any) =>
        new ScanResource(
          {
            ...scan,
            category: scan.category as ScanCategory,
            signals: scan.signals as ScanSignal[],
          },
          auth
        )
    );
  }

  /**
   * Find latest scan results by category.
   */
  static async findLatestByCategory(
    auth: ResourceAuth,
    category: ScanCategory
  ): Promise<ScanResource | null> {
    const scan = await prisma.scanResult.findFirst({
      where: {
        ...workspaceScope(auth),
        category,
      },
      orderBy: { scannedAt: "desc" },
    });

    if (!scan) return null;

    return new ScanResource(
      {
        ...scan,
        category: scan.category as ScanCategory,
        signals: scan.signals as ScanSignal[],
      },
      auth
    );
  }

  /**
   * Create a new scan result.
   */
  static async create(
    auth: ResourceAuth,
    data: {
      category: ScanCategory;
      signals: ScanSignal[];
    }
  ): Promise<ScanResource> {
    const scan = await prisma.scanResult.create({
      data: {
        workspaceId: auth.workspaceId,
        category: data.category,
        signals: data.signals as unknown as Record<string, unknown>[],
      },
    });

    return new ScanResource(
      {
        ...scan,
        category: scan.category as ScanCategory,
        signals: scan.signals as ScanSignal[],
      },
      auth
    );
  }

  // ============================================
  // Instance Methods
  // ============================================

  /**
   * Get signals filtered by severity.
   */
  getSignalsBySeverity(severity: ScanSignal["severity"]): ScanSignal[] {
    this.assertRead();
    return this._data.signals.filter((s) => s.severity === severity);
  }

  /**
   * Get critical signals (high and critical severity).
   */
  getCriticalSignals(): ScanSignal[] {
    this.assertRead();
    return this._data.signals.filter(
      (s) => s.severity === "high" || s.severity === "critical"
    );
  }

  /**
   * Delete the scan result.
   */
  async delete(): Promise<void> {
    this.assertDelete();

    await prisma.scanResult.delete({
      where: { id: this.id },
    });
  }

  // ============================================
  // Getters
  // ============================================

  get category(): ScanCategory {
    return this._data.category;
  }

  get signals(): ScanSignal[] {
    return this._data.signals;
  }

  get signalCount(): number {
    return this._data.signals.length;
  }

  get scannedAt(): Date {
    return this._data.scannedAt;
  }

  get workspaceId(): string {
    return this._data.workspaceId;
  }

  // ============================================
  // Serialization
  // ============================================

  toJSON(): Record<string, unknown> {
    this.assertRead();

    return {
      id: this.id,
      workspaceId: this.workspaceId,
      category: this.category,
      signals: this.signals,
      signalCount: this.signalCount,
      scannedAt: this.scannedAt.toISOString(),
    };
  }
}
