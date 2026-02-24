#!/usr/bin/perl
use strict;
use JSON;

my %words;
my $last;
while (<>) {
    chomp;
    my $word = $_;
    $word =~ s/\s+$//;
    if ($word =~ /^\s+/) {
        $word =~ s/^\s+//;
        $words{$last}{'nested'} = {} unless $words{$last}{'nested'};
        $words{$last}{'nested'}{$word} = make_hash($word); 
    } else {
        $last = $word;
        $words{$last} = make_hash($last);
    }
}

print to_json(\%words, { pretty => 1 });

sub make_hash {
    my $word = shift;
    my $hash = { 'short' => $word, 'long' => $word } ;
    return $hash;
}

