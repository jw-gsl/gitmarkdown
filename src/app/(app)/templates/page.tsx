'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, FileCode, Landmark, BookOpen, History, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppHeader } from '@/components/layout/app-header';
import { templates, getTemplatesByCategory } from '@/lib/templates';
import type { Template } from '@/types';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  FileCode,
  Landmark,
  BookOpen,
  History,
};

export default function TemplatesPage() {
  const router = useRouter();
  const categorized = getTemplatesByCategory();
  const [preview, setPreview] = useState<Template | null>(null);

  const handleUseTemplate = (template: Template) => {
    // Store template content in sessionStorage for the editor to pick up
    sessionStorage.setItem('template-content', template.content);
    sessionStorage.setItem('template-name', template.name);
    router.back();
  };

  return (
    <div className="flex-1">
      <AppHeader />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex items-center gap-4">
          <Button data-testid="templates-back-button" aria-label="Go back to the previous page" variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 data-testid="templates-heading" className="text-3xl font-bold">Templates</h1>
            <p className="mt-1 text-muted-foreground">Start with a pre-built template for common document types.</p>
          </div>
        </div>

        {Object.entries(categorized).map(([category, categoryTemplates]) => (
          <div key={category} className="mb-8" data-testid={`template-category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
            <h2 className="mb-4 text-lg font-semibold">{category}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categoryTemplates.map((template) => {
                const Icon = iconMap[template.icon] || FileText;
                return (
                  <Card
                    key={template.id}
                    data-testid={`template-card-${template.id}`}
                    aria-label={`${template.name} template: ${template.description}. Click to preview.`}
                    aria-expanded={preview?.id === template.id}
                    className="cursor-pointer transition-shadow hover:shadow-md"
                    onClick={() => setPreview(preview?.id === template.id ? null : template)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <CardDescription className="text-xs">{template.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {preview?.id === template.id ? (
                        <div className="space-y-3">
                          <pre className="max-h-48 overflow-auto rounded border bg-muted p-3 text-xs">
                            {template.content}
                          </pre>
                          <Button
                            data-testid={`use-template-${template.id}`}
                            aria-label={`Use the ${template.name} template and insert it into the editor`}
                            size="sm"
                            className="w-full"
                            onClick={() => handleUseTemplate(template)}
                          >
                            Use Template
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Click to preview
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
