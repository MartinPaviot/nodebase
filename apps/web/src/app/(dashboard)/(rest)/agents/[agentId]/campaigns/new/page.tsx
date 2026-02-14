'use client';

import { useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus,
  Trash,
  ArrowUp,
  ArrowDown,
  EnvelopeSimple,
  Clock,
  UploadSimple,
  ArrowRight,
  ArrowLeft,
  Check,
  Lightning,
  SpinnerGap,
} from '@phosphor-icons/react';
import { useTRPC } from '@/trpc/client';
import { useMutation } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

interface EmailStepVariant {
  directive: string;
  weight: number;
}

interface EmailStep {
  type: 'email';
  id: string;
  directive: string;
  subjectHint: string;
  toneHint: string;
  maxWords: number;
  abEnabled: boolean;
  variants: EmailStepVariant[];
}

interface WaitStep {
  type: 'wait';
  id: string;
  days: number;
  businessDaysOnly: boolean;
}

type SequenceStep = EmailStep | WaitStep;

interface MappedLead {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  linkedinUrl: string;
  phone: string;
}

type CsvMappingField = 'email' | 'firstName' | 'lastName' | 'company' | 'jobTitle' | 'linkedinUrl' | 'phone' | 'skip';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

// ============================================================================
// Helpers
// ============================================================================

let stepCounter = 0;
function generateStepId(): string {
  stepCounter += 1;
  return `step_${stepCounter}_${Date.now()}`;
}

function createEmailStep(directive = '', subjectHint = '', toneHint = 'professional'): EmailStep {
  return {
    type: 'email',
    id: generateStepId(),
    directive,
    subjectHint,
    toneHint,
    maxWords: 150,
    abEnabled: false,
    variants: [
      { directive: '', weight: 50 },
      { directive: '', weight: 50 },
    ],
  };
}

function createWaitStep(days = 3): WaitStep {
  return {
    type: 'wait',
    id: generateStepId(),
    days,
    businessDaysOnly: true,
  };
}

function parseCsv(csvText: string): { headers: string[]; rows: string[][] } {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows };
}

// ============================================================================
// Preset Sequences
// ============================================================================

function getPresetSequence(preset: 'classic' | 'aggressive' | 'soft'): SequenceStep[] {
  switch (preset) {
    case 'classic':
      return [
        createEmailStep(
          'Introduce yourself and your value proposition. Reference something specific about the prospect or their company. End with a soft question to spark conversation.',
          'Quick question about {{company}}',
          'professional'
        ),
        createWaitStep(3),
        createEmailStep(
          'Follow up on the previous email. Add a new angle or share a relevant case study. Keep it short and conversational.',
          'Re: Quick question about {{company}}',
          'casual'
        ),
        createWaitStep(4),
        createEmailStep(
          'Provide social proof or a specific result you achieved for a similar company. Create urgency without being pushy.',
          'Thought you might find this interesting',
          'professional'
        ),
        createWaitStep(5),
        createEmailStep(
          'Final follow-up. Be direct about whether this is a priority. Offer an easy way to say no. Include a breakup line.',
          'Should I close the loop?',
          'direct'
        ),
      ];

    case 'aggressive':
      return [
        createEmailStep(
          'Open with a bold, attention-grabbing statement. Reference a specific pain point you solve. Ask for a quick meeting.',
          '{{firstName}}, I noticed something about {{company}}',
          'bold'
        ),
        createWaitStep(2),
        createEmailStep(
          'Follow up with a concrete number or statistic. Make the ROI obvious. Ask if 15 minutes makes sense.',
          'The numbers behind {{company}}',
          'direct'
        ),
        createWaitStep(2),
        createEmailStep(
          'Share a quick case study. Highlight the before/after. Suggest specific times for a call.',
          'How {{similarCompany}} solved this',
          'professional'
        ),
        createWaitStep(3),
        createEmailStep(
          'Create urgency. Reference a limited offer, a time-sensitive opportunity, or market timing.',
          'Timing matters for {{company}}',
          'urgent'
        ),
        createWaitStep(2),
        createEmailStep(
          'Send a very short, casual bump. Just 2-3 sentences. Ask if the timing is off.',
          'Quick bump',
          'casual'
        ),
        createWaitStep(3),
        createEmailStep(
          'Breakup email. Wish them well. Mention you will reach out again in a few months. Leave the door open.',
          'Closing the loop',
          'friendly'
        ),
      ];

    case 'soft':
      return [
        createEmailStep(
          'Share something genuinely valuable - an insight, resource, or observation about their industry. No hard ask, just offer value.',
          'Thought of {{company}} when I saw this',
          'helpful'
        ),
        createWaitStep(5),
        createEmailStep(
          'Follow up with another piece of value. Maybe a relevant article, report, or tip. Gently mention your solution as related.',
          'Another resource for {{company}}',
          'helpful'
        ),
        createWaitStep(5),
        createEmailStep(
          'Now connect the value you have been sharing to how you can specifically help. Soft ask for a conversation if interested.',
          'Connecting the dots for {{company}}',
          'professional'
        ),
      ];

    default:
      return [];
  }
}

// ============================================================================
// Step 1: Name + Sequence
// ============================================================================

function StepNameAndSequence({
  campaignName,
  setCampaignName,
  steps,
  setSteps,
}: {
  campaignName: string;
  setCampaignName: (name: string) => void;
  steps: SequenceStep[];
  setSteps: (steps: SequenceStep[]) => void;
}) {
  const addEmailStep = () => {
    setSteps([...steps, createEmailStep()]);
  };

  const addWaitStep = () => {
    setSteps([...steps, createWaitStep()]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps);
  };

  const updateEmailStep = (index: number, updates: Partial<EmailStep>) => {
    const newSteps = [...steps];
    const step = newSteps[index];
    if (step.type === 'email') {
      newSteps[index] = { ...step, ...updates };
      setSteps(newSteps);
    }
  };

  const updateWaitStep = (index: number, updates: Partial<WaitStep>) => {
    const newSteps = [...steps];
    const step = newSteps[index];
    if (step.type === 'wait') {
      newSteps[index] = { ...step, ...updates };
      setSteps(newSteps);
    }
  };

  const applyPreset = (preset: 'classic' | 'aggressive' | 'soft') => {
    setSteps(getPresetSequence(preset));
  };

  return (
    <div className="space-y-6">
      {/* Campaign Name */}
      <div className="space-y-2">
        <Label htmlFor="campaign-name">Campaign Name</Label>
        <Input
          id="campaign-name"
          placeholder="e.g., Q1 2026 SaaS Outreach"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
        />
      </div>

      {/* Preset Buttons */}
      <div className="space-y-2">
        <Label>Presets</Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => applyPreset('classic')}>
            <Lightning className="size-3.5" />
            Classic 4-step
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset('aggressive')}>
            <Lightning className="size-3.5" />
            Aggressive 6-step
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset('soft')}>
            <Lightning className="size-3.5" />
            Soft 3-step
          </Button>
        </div>
      </div>

      {/* Sequence Builder */}
      <div className="space-y-2">
        <Label>Sequence</Label>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <Card key={step.id} className="relative">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  {/* Step Number + Type */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <Badge variant="outline" className="text-xs">
                      {index + 1}
                    </Badge>
                    {step.type === 'email' ? (
                      <EnvelopeSimple className="size-4 text-blue-500" />
                    ) : (
                      <Clock className="size-4 text-yellow-500" />
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 space-y-3">
                    {step.type === 'email' ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200">Email</Badge>
                          <div className="flex items-center gap-1">
                            <Label htmlFor={`ab-${step.id}`} className="text-xs text-muted-foreground">
                              A/B Test
                            </Label>
                            <Switch
                              id={`ab-${step.id}`}
                              checked={step.abEnabled}
                              onCheckedChange={(checked) =>
                                updateEmailStep(index, { abEnabled: checked === true })
                              }
                            />
                          </div>
                        </div>

                        {step.abEnabled ? (
                          <div className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs">Variant A</Label>
                                  <span className="text-xs text-muted-foreground">
                                    Weight: {step.variants[0].weight}%
                                  </span>
                                </div>
                                <Textarea
                                  placeholder="Directive for variant A..."
                                  value={step.variants[0].directive}
                                  onChange={(e) => {
                                    const newVariants = [...step.variants];
                                    newVariants[0] = { ...newVariants[0], directive: e.target.value };
                                    updateEmailStep(index, { variants: newVariants });
                                  }}
                                  rows={3}
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs">Variant B</Label>
                                  <span className="text-xs text-muted-foreground">
                                    Weight: {step.variants[1].weight}%
                                  </span>
                                </div>
                                <Textarea
                                  placeholder="Directive for variant B..."
                                  value={step.variants[1].directive}
                                  onChange={(e) => {
                                    const newVariants = [...step.variants];
                                    newVariants[1] = { ...newVariants[1], directive: e.target.value };
                                    updateEmailStep(index, { variants: newVariants });
                                  }}
                                  rows={3}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Weight Split (A / B)</Label>
                              <input
                                type="range"
                                min={10}
                                max={90}
                                step={10}
                                value={step.variants[0].weight}
                                onChange={(e) => {
                                  const weightA = parseInt(e.target.value);
                                  const newVariants = [
                                    { ...step.variants[0], weight: weightA },
                                    { ...step.variants[1], weight: 100 - weightA },
                                  ];
                                  updateEmailStep(index, { variants: newVariants });
                                }}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>A: {step.variants[0].weight}%</span>
                                <span>B: {step.variants[1].weight}%</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <Textarea
                            placeholder="Describe what the AI should write in this email..."
                            value={step.directive}
                            onChange={(e) => updateEmailStep(index, { directive: e.target.value })}
                            rows={3}
                          />
                        )}

                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Subject Hint</Label>
                            <Input
                              placeholder="e.g., Quick question about {{company}}"
                              value={step.subjectHint}
                              onChange={(e) => updateEmailStep(index, { subjectHint: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Tone</Label>
                            <Select
                              value={step.toneHint}
                              onValueChange={(value) => updateEmailStep(index, { toneHint: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="casual">Casual</SelectItem>
                                <SelectItem value="friendly">Friendly</SelectItem>
                                <SelectItem value="direct">Direct</SelectItem>
                                <SelectItem value="bold">Bold</SelectItem>
                                <SelectItem value="helpful">Helpful</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Max Words</Label>
                            <Input
                              type="number"
                              min={50}
                              max={500}
                              value={step.maxWords}
                              onChange={(e) => updateEmailStep(index, { maxWords: parseInt(e.target.value) || 150 })}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Wait</Badge>
                        <div className="flex items-center gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Days</Label>
                            <Input
                              type="number"
                              min={1}
                              max={30}
                              className="w-20"
                              value={step.days}
                              onChange={(e) => updateWaitStep(index, { days: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-4">
                            <Checkbox
                              id={`bdays-${step.id}`}
                              checked={step.businessDaysOnly}
                              onCheckedChange={(checked) =>
                                updateWaitStep(index, { businessDaysOnly: checked === true })
                              }
                            />
                            <Label htmlFor={`bdays-${step.id}`} className="text-xs">
                              Business days only
                            </Label>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Step Actions */}
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveStep(index, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveStep(index, 'down')}
                      disabled={index === steps.length - 1}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeStep(index)}
                    >
                      <Trash className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add Step Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={addEmailStep}>
            <EnvelopeSimple className="size-4" />
            Add Email Step
          </Button>
          <Button variant="outline" onClick={addWaitStep}>
            <Clock className="size-4" />
            Add Wait Step
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step 2: Import Leads
// ============================================================================

function StepImportLeads({
  csvHeaders,
  setCsvHeaders,
  csvRows,
  setCsvRows,
  columnMapping,
  setColumnMapping,
  mappedLeads,
  setMappedLeads,
}: {
  csvHeaders: string[];
  setCsvHeaders: (headers: string[]) => void;
  csvRows: string[][];
  setCsvRows: (rows: string[][]) => void;
  columnMapping: Record<number, CsvMappingField>;
  setColumnMapping: (mapping: Record<number, CsvMappingField>) => void;
  mappedLeads: MappedLead[];
  setMappedLeads: (leads: MappedLead[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const { headers, rows } = parseCsv(text);
        setCsvHeaders(headers);
        setCsvRows(rows);

        // Auto-map columns based on header names
        const autoMapping: Record<number, CsvMappingField> = {};
        headers.forEach((header, index) => {
          const h = header.toLowerCase().replace(/[_\s-]/g, '');
          if (h.includes('email') || h.includes('mail')) autoMapping[index] = 'email';
          else if (h.includes('firstname') || h.includes('prenom') || h === 'first') autoMapping[index] = 'firstName';
          else if (h.includes('lastname') || h.includes('nom') || h === 'last') autoMapping[index] = 'lastName';
          else if (h.includes('company') || h.includes('societe') || h.includes('entreprise') || h.includes('organization')) autoMapping[index] = 'company';
          else if (h.includes('jobtitle') || h.includes('title') || h.includes('position') || h.includes('role') || h.includes('poste')) autoMapping[index] = 'jobTitle';
          else if (h.includes('linkedin')) autoMapping[index] = 'linkedinUrl';
          else if (h.includes('phone') || h.includes('tel')) autoMapping[index] = 'phone';
          else autoMapping[index] = 'skip';
        });
        setColumnMapping(autoMapping);
      };
      reader.readAsText(file);
    },
    [setCsvHeaders, setCsvRows, setColumnMapping]
  );

  const updateMapping = (colIndex: number, field: CsvMappingField) => {
    setColumnMapping({ ...columnMapping, [colIndex]: field });
  };

  // Build mapped leads whenever mapping changes
  const previewLeads: MappedLead[] = csvRows.slice(0, 5).map((row) => {
    const lead: MappedLead = {
      email: '',
      firstName: '',
      lastName: '',
      company: '',
      jobTitle: '',
      linkedinUrl: '',
      phone: '',
    };
    Object.entries(columnMapping).forEach(([colIdx, field]) => {
      if (field !== 'skip') {
        lead[field] = row[parseInt(colIdx)] || '';
      }
    });
    return lead;
  });

  // Build all mapped leads on mapping change for the parent
  const applyMapping = useCallback(() => {
    const leads: MappedLead[] = csvRows.map((row) => {
      const lead: MappedLead = {
        email: '',
        firstName: '',
        lastName: '',
        company: '',
        jobTitle: '',
        linkedinUrl: '',
        phone: '',
      };
      Object.entries(columnMapping).forEach(([colIdx, field]) => {
        if (field !== 'skip') {
          lead[field] = row[parseInt(colIdx)] || '';
        }
      });
      return lead;
    });
    setMappedLeads(leads.filter((l) => l.email.length > 0));
  }, [csvRows, columnMapping, setMappedLeads]);

  // Apply mapping whenever it changes
  useState(() => {
    applyMapping();
  });

  // Re-apply mapping when column mapping changes
  const handleMappingChange = (colIndex: number, field: CsvMappingField) => {
    const newMapping = { ...columnMapping, [colIndex]: field };
    setColumnMapping(newMapping);

    // Rebuild leads with new mapping
    const leads: MappedLead[] = csvRows.map((row) => {
      const lead: MappedLead = {
        email: '',
        firstName: '',
        lastName: '',
        company: '',
        jobTitle: '',
        linkedinUrl: '',
        phone: '',
      };
      Object.entries(newMapping).forEach(([colIdx, f]) => {
        if (f !== 'skip') {
          lead[f] = row[parseInt(colIdx)] || '';
        }
      });
      return lead;
    });
    setMappedLeads(leads.filter((l) => l.email.length > 0));
  };

  const validLeadsCount = csvRows.length > 0
    ? csvRows.filter((row) => {
        const emailColIdx = Object.entries(columnMapping).find(([, field]) => field === 'email')?.[0];
        if (!emailColIdx) return false;
        return (row[parseInt(emailColIdx)] || '').includes('@');
      }).length
    : 0;

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <Card>
        <CardContent className="pt-6">
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 transition-colors hover:border-primary hover:bg-muted/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadSimple className="size-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Click to upload a CSV file</p>
            <p className="mt-1 text-xs text-muted-foreground">
              CSV with columns for email, name, company, etc.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </CardContent>
      </Card>

      {/* Column Mapping */}
      {csvHeaders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Column Mapping</CardTitle>
            <CardDescription>
              Map each CSV column to a lead field. Columns marked as &quot;Skip&quot; will be ignored.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {csvHeaders.map((header, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="min-w-[120px] truncate text-sm font-medium" title={header}>
                    {header}
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <Select
                    value={columnMapping[index] || 'skip'}
                    onValueChange={(value) => handleMappingChange(index, value as CsvMappingField)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="firstName">First Name</SelectItem>
                      <SelectItem value="lastName">Last Name</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="jobTitle">Job Title</SelectItem>
                      <SelectItem value="linkedinUrl">LinkedIn URL</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="skip">Skip</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Table */}
      {previewLeads.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Preview</CardTitle>
              <Badge variant="secondary">
                {validLeadsCount} leads ready to import
              </Badge>
            </div>
            <CardDescription>Showing first 5 rows</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Job Title</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewLeads.map((lead, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{lead.email || '-'}</TableCell>
                    <TableCell>{lead.firstName || '-'}</TableCell>
                    <TableCell>{lead.lastName || '-'}</TableCell>
                    <TableCell>{lead.company || '-'}</TableCell>
                    <TableCell>{lead.jobTitle || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Step 3: Configuration
// ============================================================================

function StepConfiguration({
  config,
  setConfig,
  hasAbTest,
}: {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  hasAbTest: boolean;
}) {
  const updateConfig = (updates: Partial<CampaignConfig>) => {
    setConfig({ ...config, ...updates });
  };

  const toggleDay = (day: string) => {
    const days = config.sendingDays.includes(day)
      ? config.sendingDays.filter((d) => d !== day)
      : [...config.sendingDays, day];
    updateConfig({ sendingDays: days });
  };

  return (
    <div className="space-y-6">
      {/* Sending Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sending Schedule</CardTitle>
          <CardDescription>Configure when emails should be sent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={config.timezone} onValueChange={(value) => updateConfig({ timezone: value })}>
              <SelectTrigger className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sending Days</Label>
            <div className="flex gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <Button
                  key={day}
                  variant={config.sendingDays.includes(day) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleDay(day)}
                >
                  {day}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Hour</Label>
              <Select
                value={config.startHour.toString()}
                onValueChange={(value) => updateConfig({ startHour: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i.toString().padStart(2, '0')}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>End Hour</Label>
              <Select
                value={config.endHour.toString()}
                onValueChange={(value) => updateConfig({ endHour: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i.toString().padStart(2, '0')}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sending Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sending Limits</CardTitle>
          <CardDescription>Control how many emails are sent per day</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Daily Send Limit</Label>
            <Input
              type="number"
              min={1}
              max={500}
              className="w-32"
              value={config.dailySendLimit}
              onChange={(e) => updateConfig({ dailySendLimit: parseInt(e.target.value) || 50 })}
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of emails to send per day across all mailboxes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Mailbox Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mailbox Strategy</CardTitle>
          <CardDescription>How to distribute emails across connected mailboxes</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={config.mailboxStrategy}
            onValueChange={(value) => updateConfig({ mailboxStrategy: value as CampaignConfig['mailboxStrategy'] })}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="round_robin">Round Robin</SelectItem>
              <SelectItem value="random">Random</SelectItem>
              <SelectItem value="least_used">Least Used</SelectItem>
              <SelectItem value="domain_match">Domain Match</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            {config.mailboxStrategy === 'round_robin' && 'Distribute emails evenly across all connected mailboxes.'}
            {config.mailboxStrategy === 'random' && 'Randomly select a mailbox for each email.'}
            {config.mailboxStrategy === 'least_used' && 'Use the mailbox that has sent the fewest emails recently.'}
            {config.mailboxStrategy === 'domain_match' && 'Match the mailbox domain to the lead domain when possible.'}
          </p>
        </CardContent>
      </Card>

      {/* A/B Testing */}
      {hasAbTest && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">A/B Testing</CardTitle>
            <CardDescription>
              Some steps in your sequence have A/B variants enabled. The system will track performance
              and report which variant performs better.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-600" />
              <span className="text-sm">A/B testing is enabled for this campaign</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Campaign Config Type
// ============================================================================

interface CampaignConfig {
  timezone: string;
  sendingDays: string[];
  startHour: number;
  endHour: number;
  dailySendLimit: number;
  mailboxStrategy: 'round_robin' | 'random' | 'least_used' | 'domain_match';
}

// ============================================================================
// Step Indicator
// ============================================================================

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Sequence', number: 1 },
    { label: 'Import Leads', number: 2 },
    { label: 'Configuration', number: 3 },
  ];

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center gap-2">
          <div
            className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${
              currentStep >= step.number
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {currentStep > step.number ? (
              <Check className="size-4" />
            ) : (
              step.number
            )}
          </div>
          <span
            className={`text-sm ${
              currentStep >= step.number ? 'font-medium' : 'text-muted-foreground'
            }`}
          >
            {step.label}
          </span>
          {index < steps.length - 1 && (
            <div className="mx-2 h-px w-8 bg-border" />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function NewCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  const trpc = useTRPC();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 state
  const [campaignName, setCampaignName] = useState('');
  const [steps, setSteps] = useState<SequenceStep[]>([]);

  // Step 2 state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, CsvMappingField>>({});
  const [mappedLeads, setMappedLeads] = useState<MappedLead[]>([]);

  // Step 3 state
  const [config, setConfig] = useState<CampaignConfig>({
    timezone: 'America/New_York',
    sendingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    startHour: 9,
    endHour: 17,
    dailySendLimit: 50,
    mailboxStrategy: 'round_robin',
  });

  const hasAbTest = steps.some((step) => step.type === 'email' && step.abEnabled);

  const createCampaign = useMutation(
    trpc.agents.createCampaign.mutationOptions({
      onSuccess: async (data: { id: string }) => {
        if (mappedLeads.length > 0) {
          await importLeadsMutation.mutateAsync({
            campaignId: data.id,
            leads: mappedLeads,
          });
        }
        router.push(`/agents/${agentId}/campaigns/${data.id}`);
      },
      onError: () => {
        setIsSubmitting(false);
      },
    })
  );

  const importLeadsMutation = useMutation(
    trpc.agents.importLeads.mutationOptions({})
  );

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 1:
        return campaignName.trim().length > 0 && steps.length > 0 && steps.some((s) => s.type === 'email');
      case 2:
        return true; // Leads are optional, can be added later
      case 3:
        return config.sendingDays.length > 0 && config.startHour < config.endHour;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    createCampaign.mutate({
      agentId,
      name: campaignName,
      sequence: steps.map((step) => {
        if (step.type === 'email') {
          return {
            type: 'email' as const,
            directive: step.directive,
            subjectHint: step.subjectHint,
            toneHint: step.toneHint,
            maxWords: step.maxWords,
            abEnabled: step.abEnabled,
            variants: step.abEnabled ? step.variants : undefined,
          };
        }
        return {
          type: 'wait' as const,
          days: step.days,
          businessDaysOnly: step.businessDaysOnly,
        };
      }),
      config: {
        timezone: config.timezone,
        sendingDays: config.sendingDays,
        startHour: config.startHour,
        endHour: config.endHour,
        dailySendLimit: config.dailySendLimit,
        mailboxStrategy: config.mailboxStrategy,
        abTestEnabled: hasAbTest,
      },
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">New Campaign</h1>
          <p className="text-muted-foreground">
            Create a new cold email campaign for this agent
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Step Content */}
      {currentStep === 1 && (
        <StepNameAndSequence
          campaignName={campaignName}
          setCampaignName={setCampaignName}
          steps={steps}
          setSteps={setSteps}
        />
      )}

      {currentStep === 2 && (
        <StepImportLeads
          csvHeaders={csvHeaders}
          setCsvHeaders={setCsvHeaders}
          csvRows={csvRows}
          setCsvRows={setCsvRows}
          columnMapping={columnMapping}
          setColumnMapping={setColumnMapping}
          mappedLeads={mappedLeads}
          setMappedLeads={setMappedLeads}
        />
      )}

      {currentStep === 3 && (
        <StepConfiguration
          config={config}
          setConfig={setConfig}
          hasAbTest={hasAbTest}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button
          variant="outline"
          onClick={() => {
            if (currentStep === 1) {
              router.push(`/agents/${agentId}/campaigns`);
            } else {
              setCurrentStep(currentStep - 1);
            }
          }}
        >
          <ArrowLeft className="size-4" />
          {currentStep === 1 ? 'Cancel' : 'Back'}
        </Button>

        {currentStep < 3 ? (
          <Button
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={!canProceed(currentStep)}
          >
            Next
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canProceed(currentStep) || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <SpinnerGap className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="size-4" />
                Create Campaign
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
