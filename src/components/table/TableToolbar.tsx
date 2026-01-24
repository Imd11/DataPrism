import { 
  Filter, 
  ArrowUpDown, 
  Columns3, 
  BarChart3, 
  Sparkles,
  Shuffle,
  GitMerge,
  Save,
  ChevronDown,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

interface TableToolbarProps {
  onFilter?: () => void;
  onSort?: () => void;
  onFields?: () => void;
  onAnalyze?: () => void;
  onClean?: (type: string) => void;
  onReshape?: (direction: string) => void;
  onMerge?: () => void;
  onSaveAs?: () => void;
}

export const TableToolbar = ({
  onFilter,
  onSort,
  onFields,
  onAnalyze,
  onClean,
  onReshape,
  onMerge,
  onSaveAs,
}: TableToolbarProps) => {
  return (
    <div className="h-10 px-3 flex items-center gap-1 border-b border-border bg-background">
      {/* View Controls */}
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={onFilter}
      >
        <Filter className="w-3.5 h-3.5" />
        <span className="text-xs">Filter</span>
        <ChevronDown className="w-3 h-3" />
      </Button>
      
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={onSort}
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        <span className="text-xs">Sort</span>
        <ChevronDown className="w-3 h-3" />
      </Button>
      
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={onFields}
      >
        <Columns3 className="w-3.5 h-3.5" />
        <span className="text-xs">Fields</span>
        <ChevronDown className="w-3 h-3" />
      </Button>
      
      <div className="w-px h-4 bg-border mx-1" />
      
      {/* Analysis */}
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={onAnalyze}
      >
        <BarChart3 className="w-3.5 h-3.5" />
        <span className="text-xs">Analyze</span>
      </Button>
      
      {/* Clean */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs">Clean</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Handle Missing</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onClean?.('drop-missing')}>
                Drop rows with missing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onClean?.('fill-mean')}>
                Fill with mean
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onClean?.('fill-median')}>
                Fill with median
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onClean?.('fill-forward')}>
                Forward fill
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Handle Duplicates</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onClean?.('drop-dup-first')}>
                Keep first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onClean?.('drop-dup-last')}>
                Keep last
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onClean?.('trim')}>
            Trim whitespace
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onClean?.('lowercase')}>
            Convert to lowercase
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Reshape */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span className="text-xs">Reshape</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onReshape?.('wide-to-long')}>
            Wide → Long
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onReshape?.('long-to-wide')}>
            Long → Wide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Merge */}
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={onMerge}
      >
        <GitMerge className="w-3.5 h-3.5" />
        <span className="text-xs">Merge</span>
        <ChevronDown className="w-3 h-3" />
      </Button>
      
      <div className="flex-1" />
      
      {/* Save As */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="text-xs">Save As</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onSaveAs?.()}>
            Save as new table
          </DropdownMenuItem>
          <DropdownMenuItem>
            Save to current table
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Button 
        variant="ghost" 
        size="icon" 
        className="w-7 h-7 text-muted-foreground hover:text-foreground"
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>
    </div>
  );
};
