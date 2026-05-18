"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BenefitsStep2() {
    return (
        <Card className="max-w-4xl mx-auto mt-10">
            <CardHeader>
                <CardTitle>Benefits Step 2</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">This is the second step of the benefits creation wizard.</p>
            </CardContent>
        </Card>
    );
}
