"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Waveform, Globe, Translate, Stethoscope } from "@phosphor-icons/react";

const SPEECH_OPTIONS = [
    {
        id: "single",
        name: "Single language (French detected)",
        description: "Supports: Dutch, English, Flemish, French, German, Hindi, Portuguese, Spanish.",
        icon: Waveform,
        iconColor: "text-amber-600",
    },
    {
        id: "multilingual",
        name: "Multilingual advanced",
        description: "Supports: Dutch, English, Flemish, French, German, Hindi, Portuguese, Spanish.",
        note: "Live transcription not supported",
        icon: Translate,
        iconColor: "text-emerald-600",
    },
    {
        id: "multilingual-extended",
        name: "Multilingual extended",
        description: "Supports: Chinese, Danish, Dutch, English, Flemish, French, German, Hindi, Indonesian, Italian, Japanese, Korean, Norwegian, Polish, Portuguese, Russian, Spanish, Swedish, Tamil, Tamasheq, Turkish, Ukrainian.",
        note: "Live transcription not supported",
        icon: Globe,
        iconColor: "text-emerald-600",
    },
    {
        id: "medical",
        name: "Medical (English only)",
        description: "Supports: English.",
        icon: Stethoscope,
        iconColor: "text-amber-600",
    },
];

export default function SpeechSettingsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Speech to text settings</CardTitle>
            </CardHeader>
            <CardContent>
                <RadioGroup defaultValue="single" className="space-y-4">
                    {SPEECH_OPTIONS.map((option) => (
                        <div key={option.id} className="flex items-start space-x-3">
                            <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                            <div className="grid gap-1 flex-1">
                                <div className="flex items-center gap-2">
                                    <option.icon className={`size-4 ${option.iconColor}`} />
                                    <Label htmlFor={option.id} className="font-medium">
                                        {option.name}
                                    </Label>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {option.description}
                                </p>
                                {option.note && (
                                    <p className="text-sm text-amber-600">
                                        {option.note}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </RadioGroup>

                <p className="mt-6 text-sm text-muted-foreground">
                    Streaming models instantly display spoken words in the input box. Non-streaming processes audio after it's fully recorded.
                </p>
            </CardContent>
        </Card>
    );
}
